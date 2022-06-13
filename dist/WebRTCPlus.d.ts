declare type WebRTCPlusOptions = {
    serverProtocol?: string;
    iceServers?: RTCIceServer[];
    bidirection?: boolean;
    role: string;
    signalingBindFunction: Function;
    codecs?: {
        video?: string;
        audio?: string;
    };
};
export default class WebRTCPlus {
    private options;
    private peerConnection;
    private senderList;
    private localStream?;
    private roomName?;
    private readyAddIceCandidate?;
    private candidateQueue;
    errorFunction: Function | null;
    remoteStreamUpdateFunction: Function | null;
    connectStateChangeFunction: Function | null;
    constructor(options: WebRTCPlusOptions);
    error(callback: Function): void;
    remoteStreamUpdate(callback: Function): void;
    connectStateChange(callback: Function): void;
    private sendSignal;
    signal(data: any): Promise<void>;
    private iniRTCPeerConnection;
    init(localStream?: MediaStream[]): void;
    offer(roomName: string): Promise<void>;
    answer(roomName: string): Promise<void>;
    getStats(): Promise<RTCStatsReport | null>;
    hangup(): void;
    close(): void;
}
export {};
