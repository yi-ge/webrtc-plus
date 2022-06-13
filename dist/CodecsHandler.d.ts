export declare const CodecsHandler: {
    removeVPX: (sdp: string) => string;
    disableNACK: (sdp: string) => string;
    prioritize: (codecMimeType: string, peer: RTCPeerConnection) => void;
    removeNonG722: (sdp: string) => string;
    setApplicationSpecificBandwidth(sdp: string, bandwidth: {
        [key: string]: any;
    }, isScreen: boolean): string;
    setVideoBitrates(sdp: string, params: {
        [key: string]: any;
    }): string;
    setOpusAttributes(sdp: string, params: {
        [key: string]: any;
    }): string;
    preferVP9(sdp: string): string;
    preferCodec: (sdp: string, codecName: string) => string;
    forceStereoAudio: (sdp: string) => string;
};
