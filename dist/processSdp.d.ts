export declare const processSdp: (sdp: string, codecs: {
    video: string;
    audio: string;
}, bandwidth?: {
    video?: number | undefined;
    audio?: number | undefined;
    screen?: number | undefined;
} | undefined, isScreen?: boolean) => string;
