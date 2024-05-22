import fs from "fs";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import ffmpeg from 'fluent-ffmpeg';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const openai = new OpenAI();

async function transcribe(audioInput) {
  console.log(audioInput);
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioInput),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"]
  });

  // console.log("Transcription: ", transcription);

  return transcription;
}


async function convertVideoToAudio(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .output(output)
      .on('end', function() {
        console.log('conversion ended');
        resolve();
      }).on('error', function(e) {
        console.log('error: ', e.code, e.msg);
        reject(e);
      }).run();
  });
}

const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';
const anthropicVersion = 'bedrock-2023-05-31'

export const removeUnnecessaryPartsViaLLM = async (
  prompt,
  modelId = modelId,
) => {
  // Create a new Bedrock Runtime client instance.
  const client = new BedrockRuntimeClient({ region: "us-east-1" });

  // Prepare the payload for the model.
  const payload = {
    anthropic_version: anthropicVersion,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  // Invoke Claude with the payload and wait for the response.
  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId,
  });
  const apiResponse = await client.send(command);

  // Decode and return the response(s)
  const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
  /** @type {MessagesResponseBody} */
  const responseBody = JSON.parse(decodedResponseBody);
  return responseBody.content[0].text;
};



async function getUnnecessaryParts(transcript) {
  let prompt = fs.readFileSync("claude_prompt_get_unnecessary_from_transcript.txt", "utf8");
  prompt = prompt.replace("((REPLACE_ME_WITH_TRANSCRIPT))", transcript);
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";
  // console.log(`Prompt: ${prompt}`);
  // console.log(`Model ID: ${modelId}`);

  try {
    // console.log("-".repeat(53));
    const response = await removeUnnecessaryPartsViaLLM(prompt, modelId);

    // console.log("\n" + "-".repeat(53));
    // console.log("Unnecessary parts removed successfully:");
    // console.log(response);
    return response;
  } catch (err) {
    console.log(`\n${err}`);
  }
}

async function getSegmentsToKeep(bracketedTranscript, timestampedTranscript) {
  let prompt = fs.readFileSync("claude_prompt_get_stamps_to_keep.txt", "utf8");
  // console.log(' bracketedTranscript:', bracketedTranscript);
  // console.log(' timestampedTranscript:', timestampedTranscript);
  prompt = prompt.replace("((REPLACE_ME_WITH_BRACKETED))", bracketedTranscript);
  prompt = prompt.replace("((REPLACE_ME_WITH_TIMESTAMPED))", timestampedTranscript);
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";
  const response = await removeUnnecessaryPartsViaLLM(prompt, modelId);
  // console.log(`Prompt: ${prompt}`);
  // console.log(`Model ID: ${modelId}`);

  try {
    console.log(response);
    return response;
  } catch (err) {
    console.log(`\n${err}`);
  }
}

// import ffmpeg from 'fluent-ffmpeg';

/**
 * 
 * @param {string} inputVideo 
 * @param {Array<Array<number>>} segmentsToKeep - array of arrays of timestamps to keep
 * @param {string} outputVideo - the path for the output video
 */
async function clipVideoFromSegments(inputVideo, segmentsToKeep, outputVideo) {
  const tempFiles = [];

  const createSegment = (start, end, index) => {
    return new Promise((resolve, reject) => {
      const tempFile = `temp_segment_${index}.mp4`;
      tempFiles.push(tempFile);
      ffmpeg(inputVideo)
        .setStartTime(start)
        .setDuration(end - start)
        .output(tempFile)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  };

  const mergeSegments = () => {
    return new Promise((resolve, reject) => {
      const mergedVideo = ffmpeg();
      tempFiles.forEach(file => mergedVideo.input(file));
      mergedVideo
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .mergeToFile(outputVideo);
    });
  };

  try {
    for (let i = 0; i < segmentsToKeep.length; i++) {
      const [start, end] = segmentsToKeep[i];
      await createSegment(start, end, i);
    }
    await mergeSegments();
    console.log('Video processing complete');
  } catch (error) {
    console.error('Error processing video:', error);
  }
  tempFiles.forEach(file => fs.unlinkSync(file));
}



// LETS GO!

try {
  const audioFile = 'input.mp3';
  await convertVideoToAudio('sample_video.mov', audioFile);
  console.log('Video converted to audio successfully');
  const transcript = await transcribe(audioFile);
  const transcriptText = transcript.text;
  console.log('done getting transcript');
  // console.log('actual Transcript:', transcriptText);
  const unnecessaryParts = await getUnnecessaryParts(transcriptText);
  console.log('done getting unnecessary parts: ' + unnecessaryParts);
  const transcriptAsString = JSON.stringify(transcript);
  const segmentsToKeepResponse = await getSegmentsToKeep(unnecessaryParts, transcriptAsString);
  const wantToKeepSegments = JSON.parse(segmentsToKeepResponse).result;
  console.log('done getting segments to keep: ' + wantToKeepSegments);
  clipVideoFromSegments('sample_video.mov', wantToKeepSegments, 'output.mp4');
} catch (error) {
  console.error('Error converting video to audio:', error);
}

/*

const segmentsToKeepHere = [
    [14.979999542236328, 19.100000381469727],
    [21.520000457763672, 22.139999389648438]
  ];

clipVideoFromSegments('sample_video.mov', segmentsToKeepHere, 'output.mp4');

*/



