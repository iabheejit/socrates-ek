import json
from typing import List, Dict, Tuple
from collections import defaultdict, Counter
import pandas as pd
from tqdm import tqdm
import re
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import math

def load_jsonl(file_path: str) -> List[Dict]:
    print(f"Loading data from {file_path}")
    with open(file_path, 'r') as f:
        data = [json.loads(line) for line in f]
    print(f"Loaded {len(data)} samples")
    return data

def prepare_data(data: Dict) -> Tuple[str, str]:
    messages = data.get('messages', [])
    user_message = ''
    assistant_message = ''
    
    for message in messages:
        if message['role'] == 'user':
            user_message = message['content']
        elif message['role'] == 'assistant':
            assistant_message = message['content']
    
    return user_message, assistant_message

def tokenize(text: str) -> List[str]:
    return re.findall(r'\w+', text.lower())

def get_ngrams(tokens: List[str], n: int) -> List[Tuple[str, ...]]:
    return [tuple(tokens[i:i+n]) for i in range(len(tokens)-n+1)]

def word_overlap(reference: str, prediction: str) -> float:
    ref_words = set(tokenize(reference))
    pred_words = set(tokenize(prediction))
    if not ref_words and not pred_words:
        return 1.0  # Both are empty, consider it a perfect match
    if not ref_words or not pred_words:
        return 0.0  # One is empty while the other isn't, no overlap
    overlap = len(ref_words.intersection(pred_words))
    return overlap / max(len(ref_words), len(pred_words))

def bleu_score(reference: str, prediction: str, max_n: int = 4) -> float:
    ref_tokens = tokenize(reference)
    pred_tokens = tokenize(prediction)
    
    if not ref_tokens or not pred_tokens:
        return 0.0
    
    brevity_penalty = min(1, len(pred_tokens) / len(ref_tokens))
    
    scores = []
    for n in range(1, min(max_n, len(pred_tokens)) + 1):
        ref_ngrams = Counter(get_ngrams(ref_tokens, n))
        pred_ngrams = Counter(get_ngrams(pred_tokens, n))
        
        matches = sum((ref_ngrams & pred_ngrams).values())
        total = sum(pred_ngrams.values())
        
        scores.append(matches / total if total > 0 else 0)
    
    if not any(scores):
        return 0
    
    scores = [s if s > 0 else 1e-10 for s in scores]
    
    geometric_mean = math.exp(sum(math.log(s) for s in scores) / len(scores))
    return brevity_penalty * geometric_mean

def rouge_n(reference: str, prediction: str, n: int) -> float:
    ref_ngrams = Counter(get_ngrams(tokenize(reference), n))
    pred_ngrams = Counter(get_ngrams(tokenize(prediction), n))
    
    matches = sum((ref_ngrams & pred_ngrams).values())
    total = sum(ref_ngrams.values())
    
    return matches / total if total > 0 else 0

def rouge_l(reference: str, prediction: str) -> float:
    def lcs(X, Y):
        m, n = len(X), len(Y)
        L = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if X[i-1] == Y[j-1]:
                    L[i][j] = L[i-1][j-1] + 1
                else:
                    L[i][j] = max(L[i-1][j], L[i][j-1])
        return L[m][n]
    
    ref_tokens = tokenize(reference)
    pred_tokens = tokenize(prediction)
    
    if not ref_tokens or not pred_tokens:
        return 0.0
    
    lcs_length = lcs(ref_tokens, pred_tokens)
    return lcs_length / len(ref_tokens) if ref_tokens else 0

def lexical_diversity(text: str) -> float:
    tokens = tokenize(text)
    return len(set(tokens)) / len(tokens) if tokens else 0

def sentence_count(text: str) -> int:
    return len(re.findall(r'[.!?]+', text)) + 1

def average_sentence_length(text: str) -> float:
    sentences = re.split(r'[.!?]+', text)
    word_counts = [len(tokenize(sentence)) for sentence in sentences]
    return sum(word_counts) / len(word_counts) if word_counts else 0

def tfidf_similarity(reference: str, prediction: str) -> float:
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([reference, prediction])
    return cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

def evaluate_response(reference: str, prediction: str) -> Dict:
    if not reference or not prediction:
        return {metric: 0.0 for metric in [
            "word_overlap", "bleu", "rouge_1", "rouge_2", "rouge_l", 
            "tfidf_similarity", "lexical_diversity_reference", 
            "lexical_diversity_prediction", "sentence_count_reference", 
            "sentence_count_prediction", "avg_sentence_length_reference", 
            "avg_sentence_length_prediction"
        ]}
    
    return {
        "word_overlap": word_overlap(reference, prediction),
        "bleu": bleu_score(reference, prediction),
        "rouge_1": rouge_n(reference, prediction, 1),
        "rouge_2": rouge_n(reference, prediction, 2),
        "rouge_l": rouge_l(reference, prediction),
        "tfidf_similarity": tfidf_similarity(reference, prediction),
        "lexical_diversity_reference": lexical_diversity(reference),
        "lexical_diversity_prediction": lexical_diversity(prediction),
        "sentence_count_reference": sentence_count(reference),
        "sentence_count_prediction": sentence_count(prediction),
        "avg_sentence_length_reference": average_sentence_length(reference),
        "avg_sentence_length_prediction": average_sentence_length(prediction),
    }

def evaluate_dataset(data: List[Dict]) -> List[Dict]:
    results = []
    for i, sample in enumerate(tqdm(data, desc="Evaluating samples")):
        user_message, assistant_message = prepare_data(sample)
        try:
            eval_result = evaluate_response(user_message, assistant_message)
            results.append(eval_result)
        except Exception as e:
            print(f"Error processing sample {i}: {str(e)}")
            print(f"User message: '{user_message}'")
            print(f"Assistant message: '{assistant_message}'")
    return results

def aggregate_results(results: List[Dict]) -> Dict:
    aggregated = defaultdict(list)
    for result in results:
        for metric, value in result.items():
            if value is not None:
                aggregated[metric].append(value)
    
    return {k: {'mean': sum(v)/len(v), 'std': pd.Series(v).std()} for k, v in aggregated.items() if v}

def print_results(results: Dict):
    print("\nAggregated Results:")
    for metric, stats in results.items():
        print(f"{metric}:")
        print(f"  Mean: {stats['mean']:.4f}")
        print(f"  Std Dev: {stats['std']:.4f}")

def main():
    dataset_paths = [
        'keac1dd_dataset_alpaca.jsonl'  # Replace with your actual file path if different
    ]
    
    for path in dataset_paths:
        print(f"\nEvaluating dataset: {path}")
        data = load_jsonl(path)
        
        if not data:
            print("No data loaded. Please check your file path and content.")
            continue
        
        print("Starting evaluation...")
        results = evaluate_dataset(data)
        
        if not results:
            print("No results generated. Please check the evaluate_dataset function.")
            continue
        
        print("Aggregating results...")
        aggregated_results = aggregate_results(results)
        
        print("Printing results...")
        print_results(aggregated_results)

        print("Saving detailed results to CSV...")
        df = pd.DataFrame(results)
        output_file = f"{path}_evaluation_results.csv"
        df.to_csv(output_file, index=False)
        print(f"Detailed results saved to {output_file}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
