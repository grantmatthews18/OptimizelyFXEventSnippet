// Helper Functions

// Logger Function
class Logger {
    constructor(level = 'none') {
        this.levels = ['debug', 'info', 'warn', 'error', 'none'];
        this.currentLevel = level; // Default log level
    }

    // Check if the current log level allows logging this message
    shouldLog(level) {
        return this.levels.indexOf(level) >= this.levels.indexOf(this.currentLevel);
    }

    // Log methods for each level
    debug(message) {
        if (this.shouldLog('debug')) {
            console.debug((initTime.getTime() - Date.now()) + ' | [Optimizely] /' + message);
        }
    }

    info(message) {
        if (this.shouldLog('info')) {
            console.info((initTime.getTime() - Date.now()) + ' | [Optimizely] /' + message);
        }
    }

    warn(message) {
        if (this.shouldLog('warn')) {
            console.warn((initTime.getTime() - Date.now()) + ' | [Optimizely] /' + message);
        }
    }

    error(message) {
        if (this.shouldLog('error')) {
            console.error((initTime.getTime() - Date.now()) + ' | [Optimizely] /' + message);
        }
    }

    // Set the log level dynamically
    setLevel(level) {
        if (this.levels.includes(level)) {
            this.currentLevel = level;
        } else {
            console.warn(`Invalid log level: ${level}`);
        }
    }
}

// Process Optimizely DataFile
// Currently have to make second request to get the datafile
// Ideally this would be prepopulated from Optimizely's CDN
// IDEALLY this would be prepopulated from Optimizely's CDN and only include needed info from the project
async function fetchDataFile() {
    // Fetch the datafile from Optimizely's CDN
    const response = await fetch('https://cdn.optimizely.com/datafiles/P4LP7jhFhkrY3zJ3WzT3j.json');
    if (response.status !== 200) {
        logger.error('Failed to fetch the datafile. Status: ' + response.status);
        return;
    }

    logger.info('Datafile fetched successfully.');
    return response.json();
}

// Process Push Event
function processPushEvent(event) {
    if (event && event.type === 'event') {
        trackEvent(event);
    }
    else if (event && event.type === 'user') {
        setUser(event);
    }
    else if (typeof event === 'object' && event !== null && event.type) {
        logger.warn('Invalid Push Argument: ' + event.type);
    }
    else if (typeof event === 'object' && event !== null && event.type) {
        logger.error('No Event Type Found: ' + JSON.stringify(event));
    }
    else {
        logger.error('Push not of type Object: ' + JSON.stringify(event));
    }
    return;
}

// Track Event
function trackEvent(event) {

    if (window.optimizelyFX.currentUser.id === null) {
        logger.error('No User ID set. Please set a User ID before tracking events.');
        return;
    }

    if (event.eventName) {
        const eventObject = datafile.events.find(e => e.key === event.eventName);
        if (!eventObject) {
            logger.error('Event name not found in datafile: ' + event.eventName);
            return;
        }

        var att = window.optimizelyFX.currentUser.attributes.map((attribute) => {
            return {
                e: attribute.id,
                k: attribute.name,
                t: "custom",
                v: attribute.value
            };
        });

        var body = {
            "account_id": datafile.accountId,
            "anonymize_ip": true,
            "client_name": "OptimizelyFX Event Snippet",
            "client_version": "1.0.0",
            "enrich_decisions": true,
            "project_id": datafile.projectId,
            "revision": "1",
            "visitors": [
                {
                    "visitor_id": window.optimizelyFX.currentUser.id,
                    "session_id": "AUTO",
                    "attributes": att,
                    "snapshots": [
                        {
                            "activationTimestamp": Date.now(),
                            "decisions": [],
                            "events": [
                                {
                                    "e": eventObject.id,
                                    "k": eventObject.key,
                                    "u": crypto.randomUUID(),
                                    "t": Date.now(),
                                    "a": event.tags && typeof event.tags === 'object' ? event.tags : {},
                                    "p": event.properties && typeof event.properties === 'object' ? event.properties : {},
                                    "y": "other"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Send the event to Optimizely's event endpoint
        navigator.sendBeacon('https://logx.optimizely.com/v1/events', data);
        logger.info('Event tracked: ' + event.eventName + ' for User ID: ' + window.optimizelyFX.currentUser.id);
    }
    return;
}

function setUser(event) {
    if (event.userId) {
        if (event.userId !== window.optimizelyFX.currentUser.id) {
            window.optimizelyFX.currentUser.id = event.userId;
            logger.info('User ID updated to: ' + event.userId + '. All Attributes will be reset.');
            window.optimizelyFX.currentUser.attributes = [];
        }

        if (event.attributes && typeof event.attributes === 'object') {
            for (const [key, value] of Object.entries(event.attributes)) {
                const attributeObject = datafile.attributes.find(attr => attr.key === key);
                if (!attributeObject) {
                    logger.warn(`Attribute key not found in datafile: ${key}`);
                    continue;
                }
                window.optimizelyFX.currentUser.attributes.push({
                    id: attributeObject.id,
                    name: key,
                    value: value
                })
                window.optimizelyFX.currentUser.attributes[key] = value;
                logger.info(`User attribute set: ${key} = ${value}`);
            }
        }
    }
    else {
        logger.error('No User ID provided: ' + JSON.stringify(event));
    }
}

// Initialization
const initTime = new Date();
const logger = new Logger('none'); // Set the default log level to 'info'
let datafile = null;

// Check URL query parameters for 'optimizely_log' parameter
const urlParams = new URLSearchParams(window.location.search);
const optimizelyLogLevel = urlParams.get('optimizelyfx_log');
if (optimizelyLogLevel && ['error', 'warn', 'info', 'debug', 'none'].includes(optimizelyLogLevel)) {
    logger.setLevel(optimizelyLogLevel);
    logger.info('Log level set to ' + optimizelyLogLevel.toUpperCase());
}

logger.info('Initializing OptimizelyFX Snippet...');

async function init() {
    datafile = await fetchDataFile();

    // Checking if any data was pushed before script initialization
    if (Array.isArray(window.optimizelyFX)) {
        window.optimizelyFX.forEach(function (event) {
            processPushEvent(event);
        });
    }

    // Initialize the OptimizelyFX global object
    window.optimizelyFX = {
        push: function (event) {
            processPushEvent(event);
        },
        currentUser: {
            id: null,
            attributes: []
        }
    }

    logger.info('OptimizelyFX initialized successfully.');
}

init();