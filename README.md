# Optimizely Feature Experimentation Event Only JavaScript Snippet

## Idea

In the past, many Optimizely customers have implemented the entire Feature Experimentation JavaScript SDK on their site just for event tracking. Experiment activation and delivery occurs ServerSide.

For simplicity, these customers often implement the JavaScript SDK via the unpkg CDN. The unpkg CDN has seen outtages in the past, and many customers were affected by the v5->v6 SDK update since they weren't specifying an SDK version in the request to unpkg.

Not only is loading the full JavaScript SDK from unpkg potentially unreliable, its also bulky if all the customer needs is to track conversion events triggered clientside.

The Optimizely FX Event Only Snippet is a generic account/project/environment agnostic solution that replaces the full SDK and offers a smaller, more transparent and straightforward way to track Optimizely conversion events clientside.

## Features

#### Usage Parity with the Optimizely Web Experimentation Snippet

Just like the Web Snippet, the Optimizely FX Event Only Snippet is interacted with by making  `.push() `calls to `window.optimizelyfx`. Like Web, the Optimizely FX Event Only Snippet supports pushing to `window.optimizelyfx` before the Optimizely FX Event Only Snippet has been loaded in the browser, allowing customers to queue initialization and events before the snippet has loaded.

Since the Optimizely FX Event Only Snippet only processes events, it can be loaded asynchronously after more important resources. Support for event queuing allows customers to queue up the initialization request and conversion events before the snippet loads, while still ensure that the events are processed as soon as the snippet loads.

#### Initialization with an SDK Key or Datafile URL

Easily initialize the snippet with a single JavaScript `.push()` call containing the Feature Experimentation project datafile URL or SDK key. In the same call, initialize the current user and assign any attributes.

```javascript
window.optimizelyFX.push({
    'type': 'init',
    'sdkKey': '2a6qXYH7XRi9DQezV4amE',
    'userId': '12345',
    'attributes': {
        'testAttribute': 30
    },
})
```

#### Update the Current User and Add Additional User Attributes

After initialization, the current user ID can be updated and additional user attributes can be added to the user's user context.

```javascript
window.optimizelyFX.push({
    'type': 'user',
    'userId': '12345',
    'attributes': {
        'locale': 'mn'
    }
})
```

#### Track Conversion Events

The Optimizely FX Event Only Snippet uses the same Event syntax as the Optimizely Web Experimentation snippet. Tracking a conversion event with the Optimizely FX Event Only Snippet can be done with a single `.push()` call and contains support for Event Tags and Properties, just like Web Experimentation.

```javascript
window.optimizelyFX.push({
    'type': 'event',
    'eventName': 'Test Event',
    'tags': {
        'revenue': 100,
        'value': 50
	'$opt_event_properties':{
		'Test Property': 'value'
	}
    }
})
```

*Note, Event Properties are currently only supported when passed via the reserved attribute* `$opt_event_properties`*. Support for the 'properties' key is could be developed.*

#### Robust Logging

The Optimizely FX Event Only Snippet contains a robust logger with 5 levels: 'none', 'debug', 'info', 'warn', and 'error'. By default, console logging is disabled, but it can be enabled and/or adjusted either via the URL Parameter `?optimizelyfx_log=[log level]` or via a `.push()` call, just like Web Experimentation.

```javascript
window.optimizelyFX.push({
    'type': 'log',
    'level': 'error'
})
```

## Additional Features (Planned or Not Persuing)

### [Not Persuing] Project Initialization via `<script>` URL Query Parameters or Other

#### Current Approach

The current approach for initializing the snippet requires pushing an init command to the snippet with either the project datafile or SDK key and the current user.

#### Idea

Use a:

* query parameter in the src URL used by the `<script>` tag (ex. `<script src='https://cdn.example.com/js/snippet.js?sdkKey=abc123'>`
* data-* attribute in the `<script>` tag (ex. `<script src='https://cdn.example.com/js/snippet.js' data-sdkKey='abc123'>`)

to fetch the Optimizely project configuration as the script is initially parsed so its ready immediately and doesn't need to be configured via a seperate init command.

#### Result

There is no way to parse a query parameter or data-* attribute from a `<script>` tag reliably under the following conditions:

* The `<script>` tag is using the `async` or `defer` attribute (goal of the snippet is asynchronous execution).
* There are multiple versions of the same `<script>` implemented on the page (not intended but may occur unintentionally).
