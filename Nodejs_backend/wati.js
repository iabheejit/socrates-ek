require('dotenv').config("./env")
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');


const getMessages = async (senderID, at) => {
    try {
        const response = await axios.get(
            `https://${process.env.URL}/api/v1/getMessages/${senderID}`,
            {
                headers: {
                    'Authorization': process.env.API
                },
                params: {
                    'pageSize': '10',
                    'pageNumber': '1'
                }
            }
        );
        
        at = Number(at);
        const result = response.data;
        
        if (result !== undefined && result.messages && result.messages.items) {
            const last_text = result.messages.items[at].text;
            return result.messages.items[at];
        }
    } catch (error) {
        console.error('Error in getMessages:', error?.response?.data || error.message);
        throw error;
    }
}


const sendMedia = async (buffer, filename, senderID, msg) => {
    // Create a form-data object to handle the file upload
    const form = new FormData();
    form.append('file', buffer, {
        contentType: 'application/pdf',
        filename: filename
    });

    try {
        // Make the POST request to WATI API
        const response = await axios.post(
            `https://${process.env.WATI_URL_FOR_CERTIFICATE}/api/v1/sendSessionFile/${senderID}?caption=${msg}`,
            form,
            {
                headers: {
                    'Authorization': process.env.WAIT_API, 
                    ...form.getHeaders()
                }
            }
        );

        console.log('File sent successfully');
    } catch (error) {
        console.error('Error sending file:', error);
    }
};



const sendInteractiveButtonsMessage = async (hTxt, bTxt, btnTxt, senderID) => {
    try {
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            {
                "header": {
                    "type": "Text",
                    "text": hTxt
                },
                "body": bTxt,
                "buttons": [
                    {
                        "text": btnTxt
                    }
                ]
            },
            {
                headers: {
                    'Authorization': process.env.API,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(response.data);
    } catch (error) {
        console.error('Error in sendInteractiveButtonsMessage:', error?.response?.data || error.message);
    }
}

const sendInteractiveDualButtonsMessage = async (hTxt, bTxt, btnTxt1, btnTxt2, senderID) => {
    try {
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            {
                "header": {
                    "type": "Text",
                    "text": hTxt
                },
                "body": bTxt,
                "buttons": [
                    {
                        "text": btnTxt1
                    },
                    {
                        "text": btnTxt2
                    }
                ]
            },
            {
                headers: {
                    'Authorization': process.env.API,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(response.data);
    } catch (error) {
        console.error('Error in sendInteractiveDualButtonsMessage:', error?.response?.data || error.message);
    }
}

const sendText = async (msg, senderID) => {
    console.log("Sending message to ", senderID);
    try {
        const form = new FormData();
        form.append('messageText', msg);
        
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendSessionMessage/' + senderID,
            form,
            {
                headers: {
                    'Authorization': process.env.API,
                    ...form.getHeaders()
                }
            }
        );
        
        const body = response.data;
        const result = body.result;
        // console.log(typeof result)
    } catch (error) {
        console.error('Error in sendText:', error?.response?.data || error.message);
    }
}
const sendListInteractive = async (data, body, btnText, senderID) => {
    try {
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendInteractiveListMessage?whatsappNumber=' + senderID,
            {
                "header": "",
                "body": body,
                "footer": "",
                "buttonText": btnText,
                "sections": [
                    {
                        "title": "Options",
                        "rows": data
                    }
                ]
            },
            {
                headers: {
                    'Authorization': process.env.API,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log("Result returned", response.data);
    } catch (error) {
        console.error('Error in sendListInteractive:', error?.response?.data || error.message);
        throw error;
    }
}


const sendDynamicInteractiveMsg = async (data, body, senderID) => {
    try {
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            {
                "body": body,
                "buttons": data
            },
            {
                headers: {
                    'Authorization': process.env.API,
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log(response.data);
    } catch (error) {
        console.error('Error in sendDynamicInteractiveMsg:', error?.response?.data || error.message);
        throw error;
    }
}

async function sendTemplateMessage(day, course_name, template_name, senderID) {
    const params = [{ 'name': "day", "value": day }, { 'name': "course_name", "value": course_name }];
    try {
        const response = await axios.post(
            'https://' + process.env.URL + '/api/v1/sendTemplateMessage/' + senderID,
            {
                "template_name": template_name,
                "broadcast_name": template_name,
                "parameters": JSON.stringify(params)
            },
            {
                headers: {
                    'Authorization': process.env.API,
                    'Content-Type': 'application/json',
                }
            }
        );
        
        const body = response.data;
        const result = body.result;
        // console.log(typeof result)
        if (result == false) {
            console.log("WATI error " + JSON.stringify(body));
        }
        console.log("Res " + result);
    } catch (error) {
        console.error('Error in sendTemplateMessage:', error?.response?.data || error.message);
    }
}

module.exports = {
    sendText,
    sendInteractiveButtonsMessage,
    sendMedia,
    sendListInteractive,
    sendDynamicInteractiveMsg,
    getMessages,
    sendTemplateMessage,
    sendInteractiveDualButtonsMessage
}

