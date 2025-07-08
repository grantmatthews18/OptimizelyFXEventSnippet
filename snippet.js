// Logger Class
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
            console.debug('[Optimizely] ' + message);
        }
    }

    info(message) {
        if (this.shouldLog('info')) {
            console.info('[Optimizely] ' + message);
        }
    }

    warn(message) {
        if (this.shouldLog('warn')) {
            console.warn('[Optimizely] ' + message);
        }
    }

    error(message) {
        if (this.shouldLog('error')) {
            console.error('[Optimizely] ' + message);
        }
    }

    // Set the log level dynamically
    setLevel(level) {
        if (this.levels.includes(level)) {
            this.currentLevel = level;
        }
        else {
            console.warn(`Invalid log level: ${level}`);
        }
    }
}

// Event Queue Class
class EventQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    // Add an event to the queue
    enqueue(event) {
        this.queue.push(event);
        this.processNext();
    }

    // Process the next event in the queue
    async processNext() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        const event = this.queue.shift();

        try {
            await processPushEvent(event); // Ensure processPushEvent handles async operations
        } catch (error) {
            logger.error('Error processing event: ' + JSON.stringify(event) + ' | ' + error.message);
        } finally {
            this.processing = false;
            this.processNext(); // Process the next event in the queue
        }
    }
}

// Process Push Event
async function processPushEvent(event) {
    if (event && event.type === 'init') {
        if (window.optimizelyFX.initialized) {
            logger.warn('OptimizelyFX Snippet already initialized. Skipping initialization.');
            return;
        }
        await initialize(event);
        return;
    }
    else if (event && event.type === 'event') {
        await trackEvent(event);
        return;
    }
    else if (event && event.type === 'user') {
        await setUser(event);
        return;
    }
    else if (event && event.type === 'log') {
        if (event.level && logger[event.level]) {
            logger.setLevel(event.level);
            logger.info('Log level set to ' + event.level.toUpperCase());
            return;
        } else {
            logger.error('Invalid log level or message: ' + JSON.stringify(event));
            return;
        }
    }
    else if (typeof event === 'object' && event !== null && event.type) {
        logger.warn('Invalid Push Argument: ' + event.type);
        return;
    }
    else if (typeof event === 'object' && event !== null && event.type) {
        logger.error('No Event Type Found: ' + JSON.stringify(event));
        return;
    }
    else {
        logger.error('Push not of type Object: ' + JSON.stringify(event));
        return;
    }
}

// Process Optimizely DataFile
async function fetchDataFile(sdkKey = null, url = null) {
    // Fetch the datafile from Optimizely's CDN

    if (sdkKey) {
        logger.debug('Fetching datafile for SDK Key: ' + sdkKey);
        url = `https://cdn.optimizely.com/datafiles/${sdkKey}.json`;
    }
    else if (url) {
        logger.debug('Fetching datafile from provided URL: ' + url);
        url = url;
    }
    else {
        logger.error('No SDK Key or URL provided for fetching datafile.');
        return;
    }

    const response = await fetch(url);
    if (response.status !== 200) {
        logger.error('Failed to fetch the datafile. Status: ' + response.status);
        return;
    }

    logger.debug('Datafile fetched successfully.');
    return response.json();
}

// Initialize OptimizelyFX Snippet
async function initialize(event) {

    // Check if the snippet is already initialized
    if (window.optimizelyFX.initialized) {
        logger.warn('OptimizelyFX Snippet already initialized. Skipping initialization.');
        return;
    }

    // Check if the user ID is provided
    if (!event.userId) {
        logger.error('No User ID provided for initialization. Please set a User ID.');
        return;
    }
    if (typeof event.attributes !== 'object') {
        logger.warn('User Attributes should be an Object. Skipping attributes.');
        event.attributes = {};
    }

    // Get the datafile based on SDK Key or URL
    if(event.sdkKey) {
        logger.info('Initializing OptimizelyFX Snippet with SDK Key: ' + event.sdkKey);
        datafile = await fetchDataFile(sdkKey=event.sdkKey);
        logger.info('Datafile fetched for SDK Key: ' + event.sdkKey);
    }
    else if (event.url) {
        logger.info('Initializing OptimizelyFX Snippet with URL: ' + event.url);
        datafile = await fetchDataFile(url=event.url);
        logger.info('Datafile fetched from URL: ' + event.url);
    }
    else {
        logger.error('No SDK Key or URL provided for initialization.');
        return;
    }

    // If datafile fetch fails, log an error and return
    if (!datafile) {
        logger.error('Datafile could not be fetched. Please check the SDK Key or URL.');
        return;
    }

    // Setup Datafile polling (if specified)
    if (event.pollingInterval && (typeof event.pollingInterval === 'number' && !isNaN(event.pollingInterval))) {

        pollingInterval = event.pollingInterval;
        if(pollingInterval < 1000) {
            logger.warn('Polling interval is less than 1000ms. Setting to 1000ms.');
            pollingInterval = 1000;
        }
        logger.info('Setting up polling with interval: ' + pollingInterval + 'ms');

        setInterval(async () => {
            try {
                const newDatafile = await fetchDataFile(event.sdkKey, event.url);
                if (newDatafile && newDatafile.revision !== datafile.revision) {
                    logger.info('New datafile revision detected. Updating datafile.');
                    datafile = newDatafile;
                    logger.info('Datafile updated successfully to revision: ' + datafile.revision);
                } else {
                    logger.debug('No new datafile revision found. Current revision: ' + datafile.revision);
                }
            } catch (error) {
                logger.error('Error fetching datafile during polling: ' + error.message);
            }
        }, pollingInterval);

        logger.info('Polling setup complete with interval: ' + pollingInterval + 'ms');
    }
    else if (event.pollingInterval) {
        logger.error('Invalid polling interval provided. It must be a number.');
    }
    else {
        logger.info('No polling interval provided. Skipping polling setup.');
    }

    // Set the current user
    window.optimizelyFX.currentUser = {
        id: event.userId,
        attributes: []
    };
    logger.info('Current User ID set to: ' + window.optimizelyFX.currentUser.id);

    // Check each attribute in the datafile
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

    window.optimizelyFX.initialized = true;
}

// Track Event
async function trackEvent(event) {

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

        att.push({
            e: "$opt_bot_filtering",
            k: "$opt_bot_filtering",
            t: "custom",
            v: datafile.botFiltering

        });

        var data = {
            "account_id": datafile.accountId,
            "anonymize_ip": true,
            "client_name": "OptimizelyFX Event Snippet",
            "client_version": "1.0.0",
            "enrich_decisions": true,
            "project_id": datafile.projectId,
            "revision": datafile.revision,
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
        navigator.sendBeacon('https://logx.optimizely.com/v1/events', JSON.stringify(data));
        logger.info('Event tracked: ' + event.eventName + ' for User ID: ' + window.optimizelyFX.currentUser.id);
    }
    return;
}

// Set User Attributes
async function setUser(event) {
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

// Loading the OptimizelyFX Snippet
const logger = new Logger('none'); // Set the default log level to 'none'
logger.info('Loading OptimizelyFX Snippet...');

let datafile = null;
let pollingInterval = null;
const eventQueue = new EventQueue();

// Check URL query parameters for 'optimizely_log' parameter
const urlParams = new URLSearchParams(window.location.search);
const optimizelyLogLevel = urlParams.get('optimizelyfx_log');
if (optimizelyLogLevel && ['error', 'warn', 'info', 'debug', 'none'].includes(optimizelyLogLevel)) {
    logger.setLevel(optimizelyLogLevel);
    logger.info('Log level set to ' + optimizelyLogLevel.toUpperCase());
}

// Checking if any data was pushed before script initialization
if (Array.isArray(window.optimizelyFX)) {
    window.optimizelyFX.forEach(function (event) {
        eventQueue.enqueue(event);
    });
}

window.optimizelyFX = {
    push: function (event) {
        eventQueue.enqueue(event);
    },
    currentUser: null,
    initialized: false
}

logger.info('OptimizelyFX Snippet Loaded.');