export declare const processSdp: (sdp: string, codecs: {
    video: string;
    audio: string;
}, bandwidth?: {
    video?: number;
    audio?: number;
    screen?: number;
}, isScreen?: boolean) => string;
