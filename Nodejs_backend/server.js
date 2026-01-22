// external packages
const express = require('express');
require('dotenv').config("./env");
const { validateEnvVariables } = require('./config/env-validator');
const cors = require('cors');

// Validate environment variables on startup
validateEnvVariables();
const {createCertificate} = require('./certificate')
const course_approval = require('./course_status');
var Airtable = require('airtable');
const WA = require('./wati');
const airtable = require("./airtable_methods");
const fs = require('fs');
const request = require('request');
const webApp = express();
const { sendText, sendTemplateMessage ,sendMedia,sendInteractiveButtonsMessage , sendInteractiveDualButtonsMessage} = require('./wati');
const{solveUserQuery} = require('./llama.js');
const { create } = require('domain');
const { send } = require('process');
const { validateWebhookEvent, errorHandler, requestLogger } = require('./middleware/validation');
const { sanitizeForAirtable, sanitizeUserQuery, buildSafeAndFilter } = require('./utils/validators');

// Middleware
webApp.use(express.json({ limit: '1mb' })); // Limit request body size
webApp.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));
webApp.use(requestLogger);


const getStudentData_Created = async (waId) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    try {
        console.log("Getting student data....");

        // Sanitize input to prevent injection
        const safeWaId = sanitizeForAirtable(waId);
        const filterFormula = buildSafeAndFilter([
            { field: 'Course Status', value: 'Content Created' },
            { field: 'Phone', value: safeWaId },
            { field: 'Progress', value: 'Pending' }
        ]);

        const records = await base('Student').select({
            filterByFormula: filterFormula,
        })
            .all();
        console.log(records);
        const filteredRecords = records.map(record => record.fields);
        return filteredRecords; // Note : this returns list of objects
    } catch (error) {
        console.error("Failed getting approved data", error);
        throw error; // Re-throw to allow caller to handle
    }
}
const updateStudentTableNextDayModule = async (waId, NextDay, NextModule) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    try {
        let progress = "Pending";
        const CurrentDay = NextDay;
        const CurrentModule = NextModule;

        // Logic to update NextDay and NextModule
        if (NextModule == 3) {
            NextDay++;
            NextModule = 1;
        } else {
            NextModule++;
        }
        if (NextDay == 4) progress = "Completed";

        console.log("Updating student data....");

        // Sanitize input to prevent injection
        const safeWaId = sanitizeForAirtable(waId);
        const filterFormula = buildSafeAndFilter([
            { field: 'Course Status', value: 'Content Created' },
            { field: 'Phone', value: safeWaId },
            { field: 'Progress', value: 'Pending' }
        ]);

        // Fetching the record with the specified phone and other filters
        const records = await base('Student').select({
            filterByFormula: filterFormula,
        }).all();

        if (records.length === 0) {
            console.log("No matching records found.");
            return; // Exit early if no records are found
        }

        const record = records[0];  // No need to map if we know there's a record
        const recordId = record.id;

        // Updated data to be patched into the record
        const updatedRecord = {
            "Module Completed": CurrentModule,
            "Day Completed": CurrentDay,
            "Next Day": NextDay,
            "Next Module": NextModule,
            "Progress": progress
        };

        console.log("Record ID to update:", recordId);
        console.log("Updated record data:", updatedRecord);

        // Updating the record (removed the extra "fields" key)
        await base('Student').update(recordId, updatedRecord);

        console.log("Record updated successfully");

    } catch (error) {
        console.error("Failed to update record", error);
    }
};

const getStudentData_Pending = async (waId) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    try {
        console.log("Getting student data....");

        // Sanitize input to prevent injection
        const safeWaId = sanitizeForAirtable(waId);
        const filterFormula = buildSafeAndFilter([
            { field: 'Course Status', value: 'Content Created' },
            { field: 'Phone', value: safeWaId },
            { field: 'Progress', value: 'Pending' }
        ]);

        const records = await base('Student').select({
            filterByFormula: filterFormula,
        })
            .all();
        console.log(records);
        const filteredRecords = records.map(record => record.fields);
        return filteredRecords; // Note : this returns list of objects
    } catch (error) {
        console.error("Failed getting approved data", error);
        throw error; // Re-throw to allow caller to handle
    }
}


const getCourseContent = async (courseTableName, NextModule, NextDay) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_COURSE_BASE_ID);
    try {
        console.log(NextDay, " ", NextModule);
        console.log("Getting course data from tables " + courseTableName + "....");
        const records = await base(courseTableName).select({
            filterByFormula: `{Day} = ${NextDay}`,
        })
            .all()
            .catch(err => console.log(err));
        console.log(records);
        return records;

    } catch (error) {
        console.error("Failed getting approved data", error);
    }
}

const getCourseCreatedStudent_airtable = async (waId) => {
    try {

        const records = await getStudentData_Created(waId);
        if (!records || records.length === 0) {
            console.log("No records found");
            return;
        }
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            let { Phone, Topic, Name, Goal, Style, Language, "Next Day": NextDay, "Next Module": NextModule } = record;
            const courseTableName = Topic + "_" + Phone;
            console.log(courseTableName, NextModule, NextDay);
            const courseData = await getCourseContent(courseTableName, NextModule, NextDay);
            if (!courseData || courseData.length === 0) {
                console.log("No course data found");
                return;
            }
            const currentModule = courseData[0].fields[`Module ${NextModule} Text`];
            const initialText = `Hello ${Name},\n\nI hope you are doing well. Here is your course content for today.\n Module ${NextModule}\n\n`;
            await sendText(initialText, Phone);
            setTimeout(() => { sendText(currentModule, Phone); }, 1000);

            await updateStudentTableNextDayModule(Phone, NextDay, NextModule);
            
            if (NextModule !== 3 || NextDay !== 3) {
                if (NextModule === 3) NextDay++;
                setTimeout(() => { 
                    if(NextModule ===3){
                        //Day over
                        // Now QNA time: user can ask for doubts.
                        sendInteractiveDualButtonsMessage(`Hey👋 ${Name}`, "You have completed the day's module. Do you have any doubts?", "Yes", "No", Phone); 
                    }else{
                        sendInteractiveButtonsMessage(`Hey👋 ${Name}`, "Don't let the learning stop!! Start next Module", "Next Module", Phone);
                    }
                }, 10000);

            } else {
                setTimeout(async() => {
                    sendText("Congratulations🎉🎊! You have completed the course. We are preparing your certificate of completion", Phone);
                    const pdfbuffer = await createCertificate(Name, Topic);
                    setTimeout(() => {
                        sendMedia(pdfbuffer,Name,Phone,"Hey👋, your course completion certificate is ready!! Don't forget to share your achievement.");
                    },5000);
                })
            }

            console.log(currentModule);
        }
    } catch (error) {
        console.error("Failed getting approved data", error);

    }
}

const get_student_table_send_remainder = async () => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    const records = await base('Student').select({
        filterByFormula: `AND({Course Status} = 'Content Created', {Progress} = 'Pending')`,
    }).all();
    for(let i=0;i<records.length;i++){
        let { Phone, Topic, Name, Goal, Style, Language, "Next Day": NextDay, "Next Module": NextModule } = records[i].fields;
        sendTemplateMessage(NextDay, Topic, "generic_course_template", Phone); sendText("Press Start Day to get started with next Module", Phone);

    }
}

const setDoubtBit = async (waId, doubtBit,Title) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    try {
        console.log("Setting doubt bit....");

        // Sanitize inputs to prevent injection
        const safeWaId = sanitizeForAirtable(waId);
        const safeTitle = sanitizeForAirtable(Title);
        const filterFormula = buildSafeAndFilter([
            { field: 'Phone', value: safeWaId },
            { field: 'Progress', value: 'Pending' },
            { field: 'Topic', value: safeTitle }
        ]);

        // Fetching the record with the specified phone and other filters
        const records = await base('Student').select({
            filterByFormula: filterFormula,
        }).all();

        if (records.length === 0) {
            console.log("No matching records found.");
            return; // Exit early if no records are found
        }

        const record = records[0];  // No need to map if we know there's a record
        const recordId = record.id;

        // Updated data to be patched into the record
        const updatedRecord = {
            "Doubt": doubtBit
        };

        console.log("Record ID to update:", recordId);
        console.log("Updated record data:", updatedRecord);

        // Updating the record (removed the extra "fields" key)
        await base('Student').update(recordId, updatedRecord);

        console.log("Record updated successfully");

    } catch (error) {
        console.error("Failed to update record", error);
    }
}

const getDoubtBit = async (waId,Title) => {
    var base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_STUDENT_BASE_ID);
    try {
        console.log("Getting doubt bit....");

        // Sanitize inputs to prevent injection
        const safeWaId = sanitizeForAirtable(waId);
        const safeTitle = sanitizeForAirtable(Title);
        const filterFormula = buildSafeAndFilter([
            { field: 'Phone', value: safeWaId },
            { field: 'Progress', value: 'Pending' },
            { field: 'Topic', value: safeTitle }
        ]);

        // Fetching the record with the specified phone and other filters
        const records = await base('Student').select({
            filterByFormula: filterFormula,
        }).all();

        if (records.length === 0) {
            console.log("No matching records found.");
            return; // Exit early if no records are found
        }

        const record = records[0];

        return record?.fields?.Doubt;

    } catch (error) {
        console.error("getdoubtbit fucntion: Failed to update record", error);
    }
}

webApp.get('/nextday', async (req, res) => {
    get_student_table_send_remainder();
    res.send("Sending Remainder to students");
});

webApp.post('/cop', validateWebhookEvent, async (req, res) => {
    const event = req.body;


    if ((event.eventType === 'message' && event.buttonReply && event.buttonReply.text === 'Start Day')) {
        console.log("Button Clicked");

        getCourseCreatedStudent_airtable(event.waId);

        console.log(event);


        const buttonText = event.buttonReply.text;
        const buttonPayload = event.buttonReply.payload;

        // console.log(`Button Text: ${buttonText}`);
        // console.log(`Button Payload: ${buttonPayload}`);


    }else if(event.type === 'interactive' &&  event.text === 'Next Module'){
        console.log("Button Clicked");

        getCourseCreatedStudent_airtable(event.waId);

        
    }else if(event.type === 'interactive' &&  event.text === 'Yes'){
        console.log("Button Clicked Yes");
        try {
            const records = await getStudentData_Pending(event.waId);
            const record = records[0];
            const { Phone, Topic, Name, Goal, Style, Language, "Next Day": NextDay, "Next Module": NextModule,"Doubt":Doubt } = record;
            //set doubt bit to true;
            setDoubtBit(event.waId,1,Topic);
        } catch (error) {
            console.error("Failed getting approved data", error);
        }
        sendText("Please type your query", event.waId);
    }else if(event.type==='interactive' && event.text === 'No'){
        //set doubt bit to false;
        try {
            const records = await getStudentData_Pending(event.waId);
            const record = records[0];
            const { Phone, Topic, Name, Goal, Style, Language, "Next Day": NextDay, "Next Module": NextModule,"Doubt":Doubt } = record;
            //set doubt bit to true;
            setDoubtBit(event.waId,0,Topic);
        } catch (error) {
            console.error("Failed getting approved data", error);
        }
        
        console.log("Button Clicked No");
        sendText("Great!! Keep learning and See you tomorrow!", event.waId);
    }else if(event.eventType === 'message'){
        let flag=false;
        let doubt=0;
        let name="User";
        let Phone=event.waId;
        try {
            const records = await getStudentData_Pending(event.waId);
            const record = records[0];
            const { "Name":Name, "Doubt":Doubt } = record;
            flag = true;
            doubt = Doubt;
            name=Name;
            
        } catch (error) {
            console.error("Failed getting approved data", error);
        }
        if(flag && doubt==1){
            //User query
            console.log("User Query", event.text);
            try {
                // Sanitize user query to prevent prompt injection
                const sanitizedQuery = sanitizeUserQuery(event.text);
                await solveUserQuery(sanitizedQuery, event.waId);
            } catch (error) {
                console.error("Invalid user query", error);
                await sendText("Sorry, your query contains invalid content. Please rephrase and try again.", event.waId);
                return res.sendStatus(200);
            }
            setTimeout(async () => {
                await sendInteractiveDualButtonsMessage(
                    `Hey👋 ${name}`, 
                    "Any other doubts?", 
                    "Yes", 
                    "No", 
                    Phone
                );
            }, 1000);  // 10 seconds delay

        }

    };


    res.sendStatus(200);//send acknowledgement to wati server
});


// Health check endpoint (separated from business logic)
webApp.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Legacy ping endpoint (triggers course approval)
webApp.get("/ping", async (req, res) => {
    console.log("Pinging whatsapp server")
    course_approval.course_approval()
    res.send("Booting Up AI Engine.........")
})

// Error handler middleware (must be last)
webApp.use(errorHandler);

const port = process.env.port || 3000;
const server = webApp.listen(port, () => {
    console.log(`✅ Server is up and running at port ${port}`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
});

// Graceful shutdown handler
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('👋 Process terminated gracefully');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));