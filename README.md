# Bumblebee Hotword for NodeJS

![screenshot](logo.png)

Bumblebee Hotword starts recording the system microphone and emits an event when it hears the available hotwords.

This is a stripped down and repackaged version of the excellent [Porcupine](https://github.com/Picovoice/Porcupine) wake word (hotword) system. This requires no cloud services and is freely available to use under the Apache 2.0 license (GPLv3 compatible).

This is the NodeJS version of Bumblebee Hotword.  If you need hotword detection in the browser or ElectronJS see [here](https://github.com/jaxcore/bumblebee-hotword).

Hotword detection is just one part of the larger Bumblebee voice application framework, for more information see:

- [https://github.com/jaxcore/bumblebee](https://github.com/jaxcore/bumblebee)

## Install

Using npm:

```
npm install bumblebee-hotword-node
```

### Quick Start

```
const Bumblebee = require('bumblebee-hotword-node');
const bumblebee = new Bumblebee();
bumblebee.addHotword('bumblebee');

bumblebee.on('hotword', function (hotword) {
	console.log('Hotword Detected:', hotword);
});

bumblebee.start();
```

### Hotwords

The hotwords available by default are:

* alexa
* computer
* bumblebee
* grasshopper
* hey_edison
* hey_google
* hey_siri
* jarvis
* porcupine
* terminator

The hotword that is detected can be retreived in the `.on('hotword')` event:

```
bumblebee.on('hotword', function(hotword) {
	console.log('hotword detected:', hotword);
});
```

To only receive a hotword event for one of the hotwords, use the `setHotword()` method:

```
bumblebee.setHotword('hey_edison');
```

The [Picovoice hotwords open source hotwords](https://github.com/Picovoice/Porcupine/tree/master/resources/keyword_files) are freely usable under the Apache 2.0 license.  Custom hotwords can be licensed from [https://picovoice.ai](https://picovoice.ai/).

### Add New Hotwords

The default hotwords were open sourced and [supplied by Picovoice](https://github.com/Picovoice/porcupine/tree/master/resources/keyword_files/wasm).

To convert a PPN hotword file to the formate used by Bumblebee, use the `xdd` command:

```
xxd -i -g 1 white\ smoke_wasm.ppn output.hex
```

Then take byte array contents of `output.hex`:

```
unsigned char americano_wasm_ppn[] = {
    /* COPY THE CONTENTS HERE */
};
unsigned int americano_wasm_ppn_len = 3008;
```

And create a new hotword JavaScript file with the format:

```
module.exports = new Uint8Array([
    /* PASTE THE CONTENTS HERE */
]);
```

Add the hotword file to Bumblebee Hotword using;

```
bumblebee.addHotword('white_smoke', require('./white_smoke.js'));
```

See the [full example](https://jaxcore.github.io/bumblebee-hotword-node/full-example/)

### Sensitivity

Hotword detection sensitivity (0.0 to 1.0) is configurable only before the first call to `bumblebee.start()`

```
bumblebee.setSensitivity(0.8);
```

### Disable Bumblebee

Use the stop() method to disable the microphone and all processing:

```
bumblebee.stop();
```

### Audio Data

Bumblebee Hotword records audio from the microphone in 16bit/16khz PCM format and emits a stream of "data" events so the audio can be processed by other systems (such as [DeepSpeech](https://github.com/jaxcore/deepspeech-plugin)):

```
bumblebee.on('data', function(data) {
	console.log('data', data);
});
```

### Audio Stream

Instead of using the system microphone, an audio stream can be supplied.  The audio format must be a Float32Array (32 bit signed floating point values) at 16Khz sample rate.  Refer to the `wav-example` example.

```
// some audioInputStream object (eg. ffmpeg)

bumblebee.start({stream: audioInputStream});
```

## Run Examples Locally

Clone this repo, then...

For the `basic` example:

```
cd examples/basic-example
node start.js
```

For the `full` example:

```
cd examples/full-example
npm install --mpg123-backend=openal
node start.js
```

For the `wav` file stream example:

```
cd examples/wav-example
npm install fluent-ffmpeg
node start.js
```


## License

This repository is licensed under Apache 2.0.  See [Porcupine](https://github.com/Picovoice/Porcupine) for more details.

## Change Log

- *v0.2.0*: upgrade to Porcupine v1.9, added new hotwords
- *v0.1.1*: added `device` path option to be sent to sox/rec
- *v0.1.0*: fixed `sox` path for Ubuntu/Linux
- *v0.0.10*: added white_smoke and blueberry to default hotwords, clean up debug statements
- *v0.0.9*: now includes a modified copy of `node-audiorecorder` that exposes a paths option, see full-example
- *v0.0.8*: refactor Porcupine files, added the float32 to the "data" event, and a typo
- *v0.0.6*: upgrade to Porcupine v1.8 (latest as of May 28, 2020)