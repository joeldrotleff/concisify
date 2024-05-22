## Inspiration

Michael & I are heavy users of a video messaging app called Marco Polo (And we also work there). So we send lots of video messages to each other, some work-related and some just for fun. But sometimes, our videos get a little, uh, you know, long winded. So we wanted to see if we could use LLMs to edit out the unnecessary bits, aka "concicify" our videos.


## What it does

Concisify takes an input video (i.e. of a person talking), generates a transcript of the video via Whisper, then asks Anthropic Claude to indicate which parts of the video should be cut out (i.e. which are the unimportant, "filler" parts of the video). It then uses ffmpeg to cut out the unnecessary video parts and produce an output video file which is shown in the front end NextJS UI.

## How we built it

We used AWS for hosting our web app front end which uses NextJS, with a backend AWS lambda function for converting the videos.  AWS Bedrock was used for querying the Anthropic Claude model. We also used SST for orchestrating AWS deploys, and the Whisper API for getting transcripts of videos. We also use the ffmpeg library for clipping the video.

But how much "concifying" is the *right* amount of concicifying? We have no idea, so to find out we feature flagged it via LaunchDarkly, so now we can run some AB tests to find out which level of concification makes our users the happiest.


## Challenges we ran into

Trying to write Javascript code to parse transcripts with brackets was taking too long so we ended up getting Claude to do it for us, that was fun.



## Accomplishments that we're proud of

Prompt engineering is pretty tricky, feels like a milestone that we were able to come up with two novel prompts in short order

Also really proud to have spun up a working app in <6 hours!



## What we learned

Building feature flags is a lot easier with LaunchDarkly than what we're used to (i.e. in house feature flags). SST makes spinning up AWS resources feel great, and it's super cool to be able to quickly choose between LLM models via the Bedrock sandbox.


## What's next for Concisify

There's lots to do trying to make the editing more accurate (particularly getting the transcript to be more precises will help with this). We want to try using Amazon Transcribe to see if it helps with this, or maybe running Whisper ourselves on Bedrock.

