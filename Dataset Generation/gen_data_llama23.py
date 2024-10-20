import json
import random
import ssl
import PyPDF2
import os
import re
from typing import List, Dict, Any
from tqdm import tqdm
import nltk
from nltk.tokenize import sent_tokenize
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
import concurrent.futures
import asyncio
from functools import lru_cache

# SSL Workaround for NLTK download
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

nltk.download('punkt', quiet=True)

# Configuration
INPUT_FOLDER = r""
NUM_ROWS = 10000
OUTPUT_FILE = "nptel_dataset_research.jsonl"
BATCH_SIZE = 10  # Number of questions/answers to generate in a single batch


# Azure AI API setup
API_KEY = ""

client = ChatCompletionsClient(
    endpoint='https://Llama-3-2-90B-Vision-Instruct-lv.eastus2.models.ai.azure.com',
    credential=AzureKeyCredential(API_KEY)
)


HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

def read_document(file_path: str) -> str:
    """Read content from PDF, TXT, or DOCX file."""
    try:
        if file_path.lower().endswith('.pdf'):
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                return ' '.join([page.extract_text() for page in reader.pages])
        elif file_path.lower().endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        elif file_path.lower().endswith('.docx'):
            doc = docx.Document(file_path)
            return ' '.join([para.text for para in doc.paragraphs])
        else:
            print(f"Unsupported file format: {file_path}")
            return ""
    except Exception as e:
        print(f"Error reading {file_path}: {str(e)}")
        return ""

def clean_text(text: str) -> str:
    """Clean and preprocess the input text."""
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'(\b\w+\b)(\s+\1\b)+', r'\1', text)
    return text.lower()

def chunk_text(text: str, chunk_size: int = 2500) -> List[str]:
    """Split the text into chunks of approximately equal size."""
    sentences = sent_tokenize(text)
    chunks, current_chunk, current_size = [], [], 0
    
    for sentence in sentences:
        if current_size + len(sentence) > chunk_size and current_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk, current_size = [], 0
        current_chunk.append(sentence)
        current_size += len(sentence)
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

@lru_cache(maxsize=1000)
def generate_question(chunk: str) -> str:
    system_message = "You are simulating a curious learner who is trying to understand the given content. Ask a thought-provoking question that would help you gain a deeper understanding of the main concepts."
    
    prompt = f"""As a learner encountering the following content for the first time, what question would you ask to better understand the main ideas or their implications? Your question should:
1. Be specific to the content provided
2. Demonstrate a genuine desire to understand the topic more deeply
3. Encourage exploration of the concept's significance or real-world applications
4. Include key terms from the input text to maintain relevance
5. Directly ask the question only.
6. Ensure the question is within the token limit of 20 and a complete thought. 
Content: {chunk[:2000]}
Learner's question:"""
    
    try:
        payload = {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 20,
            "temperature": 0.6,  # Lower temperature for precision
            "top_p": 0.9
        }
        response = client.complete(payload)
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating question: {e}")
        return "What are the key ideas discussed in this text?"


@lru_cache(maxsize=1000)
def generate_answer(question: str, chunk: str) -> str:
    system_message = "You are Alfred, an AI tutor built by ekatra, designed to guide learners towards understanding through Socratic questioning and critical thinking."
    
    prompt = f"""Given the following question and context, provide a thoughtful response that both explains the concept and guides the learner towards deeper understanding. Your answer should:
    1. Include at least two key phrases or concepts from the context.
    2. Directly address the question while using phrases and terminology from the context.
    3. Limit your answer to about 120 words.
    4. Avoid repeating the same words or phrases too often.
    5. Keep sentence structure and flow similar to the input text.
    6. Conclude with a question or reflection that encourages deeper thinking.
    7. Ensure the response is within the token limit of 100 and a complete thought. 
    Question: {question}
    Context: {chunk[:2500]}
    Alfred's response:"""

    try:
        payload = {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 100,
            "temperature": 0.5,
            "top_p": 0.95
        }
        response = client.complete(payload)
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating answer: {e}")
        return "Let's approach this step-by-step. What do you think are the key elements we should consider based on the information provided?"

async def generate_qa_pair(chunk: str) -> Dict[str, Any]:
    question = await asyncio.to_thread(generate_question, chunk)
    answer = await asyncio.to_thread(generate_answer, question, chunk)
    
    return {
        "messages": [
            {"role": "system", "content": "You are Alfred, an AI tutor built by ekatra, designed to guide learners towards understanding through Socratic questioning and critical thinking."},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer}
        ]
    }

async def generate_dataset_batch(chunks: List[str], batch_size: int) -> List[Dict[str, Any]]:
    tasks = [generate_qa_pair(chunk) for chunk in random.sample(chunks, batch_size)]
    return await asyncio.gather(*tasks)

async def generate_dataset(content: str, num_rows: int) -> List[Dict[str, Any]]:
    chunks = chunk_text(clean_text(content))
    dataset = []
    
    with tqdm(total=num_rows, desc="Generating Alpaca-style dataset") as pbar:
        while len(dataset) < num_rows:
            batch_size = min(BATCH_SIZE, num_rows - len(dataset))
            batch_results = await generate_dataset_batch(chunks, batch_size)
            dataset.extend(batch_results)
            pbar.update(len(batch_results))
    
    return dataset[:num_rows]

def save_dataset(dataset: List[Dict[str, Any]], output_file: str):
    """Save the dataset in JSONL format."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in dataset:
            f.write(json.dumps(item) + '\n')

def get_compatible_files(folder_path):
    """Scan the given folder for compatible files (PDF, TXT, DOCX)."""
    return [os.path.join(root, file) for root, _, files in os.walk(folder_path) 
            for file in files if file.lower().endswith(('.pdf', '.txt', '.docx'))]

def test_api_call():
    try:
        model_info = client.get_model_info()
        print("Model name:", model_info.model_name)
        print("Model type:", model_info.model_type)
        print("Model provider name:", model_info.model_provider_name)

        payload = {
            "messages": [
                {"role": "user", "content": "Hello, how are you?"}
            ],
            "max_tokens": 50,
            "temperature": 0.4,
            "top_p": 0.95
        }
        response = client.complete(payload)
        print("Response:", response.choices[0].message.content)
        print("Model:", response.model)
        print("Usage:")
        print(" Prompt tokens:", response.usage.prompt_tokens)
        print(" Total tokens:", response.usage.total_tokens)
        print(" Completion tokens:", response.usage.completion_tokens)
    except Exception as e:
        print(f"Error in test API call: {e}")

def save_dataset(dataset: List[Dict[str, str]], output_file: str):
    """Save the dataset in JSONL format."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in dataset:
            f.write(json.dumps(item) + '\n')

def get_compatible_files(folder_path):
    """Scan the given folder for compatible files (PDF, TXT, DOCX)."""
    return [os.path.join(root, file) for root, _, files in os.walk(folder_path) 
            for file in files if file.lower().endswith(('.pdf', '.txt', '.docx'))]

async def main():
    if not os.path.isdir(INPUT_FOLDER):
        print(f"Error: The specified path is not a valid directory: {INPUT_FOLDER}")
        return

    compatible_files = get_compatible_files(INPUT_FOLDER)
    
    if not compatible_files:
        print(f"No compatible files (PDF, TXT, DOCX) found in the specified folder: {INPUT_FOLDER}")
        return

    all_content = ""
    for file_path in compatible_files:
        content = read_document(file_path)
        if content:
            all_content += content + "\n\n"
            print(f"Successfully read: {file_path}")
    
    if not all_content:
        print("No valid content could be extracted from the files. Exiting.")
        return
    
    try:
        dataset = await generate_dataset(all_content, NUM_ROWS)
        save_dataset(dataset, OUTPUT_FILE)
        print(f"Dataset successfully generated and saved to {OUTPUT_FILE}")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    test_api_call()
    asyncio.run(main())
