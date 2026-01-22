const axios = require('axios');
require('dotenv').config("./env")
const FormData = require('form-data');
const fs = require('fs');


const getMessages = async (senderID, at) => {
    try {
        const response = await axios({
            method: 'GET',
            url: `https://${process.env.URL}/api/v1/getMessages/${senderID}`,
            headers: {
                'Authorization': process.env.API
            },
            params: {
                'pageSize': '10',
                'pageNumber': '1'
            }
        });
        
        at = Number(at);
        const result = response.data;
        
        if (result != undefined && result.messages && result.messages.items[at]) {
            return result.messages.items[at];
        }
    } catch (error) {
        console.log(error);
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
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            headers: {
                'Authorization': process.env.API,
                'Content-Type': 'application/json',
            },
            data: {
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
            }
        });
        console.log(response.data);
    } catch (error) {
        console.log(error);
    }
}

const sendInteractiveDualButtonsMessage = async (hTxt, bTxt, btnTxt1, btnTxt2, senderID) => {
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            headers: {
                'Authorization': process.env.API,
                'Content-Type': 'application/json',
            },
            data: {
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
            }
        });
        console.log(response.data);
    } catch (error) {
        console.log(error);
    }
}

const sendText = async (msg, senderID) => {
    console.log("Sending message to ", senderID);
    try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('messageText', msg);
        
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendSessionMessage/' + senderID,
            headers: {
                'Authorization': process.env.API,
                ...form.getHeaders()
            },
            data: form
        });
        
        const body = response.data;
        const result = body.result;
    } catch (error) {
        console.log(error);
    }
}
const sendListInteractive = async (data, body, btnText, senderID) => {
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendInteractiveListMessage?whatsappNumber=' + senderID,
            headers: {
                'Authorization': process.env.API,
                'Content-Type': 'application/json',
            },
            data: {
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
            }
        });
        console.log("Result returned", response.data);
    } catch (error) {
        throw new Error(error);
    }
}


const sendDynamicInteractiveMsg = async (data, body, senderID) => {
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendInteractiveButtonsMessage?whatsappNumber=' + senderID,
            headers: {
                'Authorization': process.env.API,
                'Content-Type': 'application/json',
            },
            data: {
                "body": body,
                "buttons": data
            }
        });
        console.log(response.data);
    } catch (error) {
        throw new Error(error);
    }
}

async function sendTemplateMessage(day, course_name, template_name, senderID) {
    const params = [{ 'name': "day", "value": day }, { 'name': "course_name", "value": course_name }];
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://' + process.env.URL + '/api/v1/sendTemplateMessage/' + senderID,
            headers: {
                'Authorization': process.env.API,
                'Content-Type': 'application/json',
            },
            data: {
                "template_name": template_name,
                "broadcast_name": template_name,
                "parameters": JSON.stringify(params)
            }
        });
        
        const body = response.data;
        const result = body.result;
        
        if (result == false) {
            console.log("WATI error " + JSON.stringify(body));
        }
        console.log("Res " + result);
    } catch (error) {
        console.log("WATI error", error);
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

