// This code here is partially based zn
// https://github.com/Picovoice/web-voice-processor/blob/master/src/downsampling_worker.js

/*
Bumblebee Transcoder
--------------------

receives audio data in float32 44100 Hz
1) downsamples to 16000 Hz
2) processes the audio for hotwords using Porcupine
3) emits 2 output strems along with the hotword

Output streams:
 - vad = float32Array 16KHz (for node-vad processing)
 - deepspeech = Buffer (int16 le for deepspeech0
 
*/

// onmessage = function (e) {
//     switch (e.data.command) {
//         case "init":
//             init(e.data.inputSampleRate);
//             break;
//         case "process":
//             process(e.data.inputFrame);
//             break;
//         case "reset":
//             reset();
//             break;
//     }
// };

let inputBuffer = [];

function downsampleBuffer(buffer, sourceRate, targetRate) {
    if (targetRate === sourceRate) {
        return buffer;
    }
    if (targetRate > sourceRate) {
        throw "downsampling rate show be smaller than original sample rate";
    }
    var sampleRateRatio = sourceRate / targetRate;
    
    var newLength = Math.round(buffer.length / sampleRateRatio);
    
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
        var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        // Use average value of skipped samples
        var accum = 0, count = 0;
        for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        // Or you can simply get rid of the skipped samples:
        // result[offsetResult] = buffer[nextOffsetBuffer];
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

function transcoder(bumblebee, inputFrame, inputSampleRate, targetSampleRate, targetChunkSize) {
    let outputs = [];
    // let porcupineData = [];
    
    const float32data = downsampleBuffer(inputFrame, inputSampleRate, targetSampleRate);
    
    for (let i = 0; i < inputFrame.length; i++) {
        inputBuffer.push((inputFrame[i]) * 32767);
    }
    
    const PV_SAMPLE_RATE = targetSampleRate || 16000;
    const PV_FRAME_LENGTH = targetChunkSize || 512;
    
    let hotword;
    
    while ((inputBuffer.length * PV_SAMPLE_RATE / inputSampleRate) > PV_FRAME_LENGTH) {
        let outputFrame = new Int16Array(PV_FRAME_LENGTH);
        // let outputBuffer = Buffer.alloc(PV_FRAME_LENGTH);
        let sum = 0;
        let num = 0;
        let outputIndex = 0;
        let inputIndex = 0;
        
        while (outputIndex < PV_FRAME_LENGTH) {
            sum = 0;
            num = 0;
            while (inputIndex < Math.min(inputBuffer.length, (outputIndex + 1) * inputSampleRate / PV_SAMPLE_RATE)) {
                sum += inputBuffer[inputIndex];
                num++;
                inputIndex++;
            }
            outputFrame[outputIndex] = sum / num;
            // let avg = sum / num;
            // console.log(outputIndex, ';', sum + '/' + num, ' = ', outputFrame[outputIndex])
            // outputBuffer.write(avg)
            outputIndex++;
        }
    
        // outputs.push(outputFrame);
        
        // porcupineData.push(outputFrame);
    
        if (bumblebee.enabled) {
            let presult = bumblebee.processPorcupine(outputFrame);
            if (presult) {
                hotword = presult;
                console.log('hotword FOUND', hotword);
            }
        }
        
        var uint8View = new Uint8Array(outputFrame.buffer);
        let buffer = Buffer.from(uint8View);
        
        outputs.push(buffer);
        
        // outputs.push(outputBuffer);
        // postMessage(outputFrame);
        
        inputBuffer = inputBuffer.slice(inputIndex);
    }
    
    let length = 0;
    outputs.forEach(function (buf) {
        length += buf.length;
    });
    
    return {
        vad: float32data,
        deepspeech: Buffer.concat(outputs, length),
        hotword
        // porcupine: porcupineData
    };
}

function reset() {
    inputBuffer = [];
}

module.exports = transcoder;
transcoder.reset = reset;