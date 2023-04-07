import { processSdp } from './processSdp'
import adapter from 'webrtc-adapter'

type WebRTCPlusOptions = {
  serverProtocol?: string,
  iceTransportPolicy?: string,
  iceServers?: RTCIceServer[]
  bidirection?: boolean,
  role: string,
  signalingBindFunction: Function,
  codecs?: {
    video?: string,
    audio?: string
  }
}

console.log(adapter.browserDetails.browser, adapter.browserDetails.version)

export default class WebRTCPlus {
  private options: WebRTCPlusOptions

  private peerConnection: RTCPeerConnection | null = null
  private senderList: RTCRtpSender[] = []
  private localStream?: MediaStream[]
  private roomName?: string
  private readyAddIceCandidate?: boolean = false
  private candidateQueue: RTCIceCandidateInit[] = []

  public errorFunction: Function | null = null
  public remoteStreamUpdateFunction: Function | null = null
  public connectStateChangeFunction: Function | null = null

  constructor (
    options: WebRTCPlusOptions
  ) {
    this.options = Object.assign({ serverProtocol: window.location.protocol, bidirection: true, role: 'provider' }, options)
  }

  error (callback: Function) {
    this.errorFunction = callback
  }

  remoteStreamUpdate (callback: Function) {
    this.remoteStreamUpdateFunction = callback
  }

  connectStateChange (callback: Function) {
    this.connectStateChangeFunction = callback
  }

  private sendSignal (data: any) {
    if (this.options.signalingBindFunction) this.options.signalingBindFunction(data)
  }

  async signal (data: any) {
    if (data.action === 'offer') {
      if (this.peerConnection && data.role !== this.options.role) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.offer)))
        const answer = await this.peerConnection.createAnswer()
        try {
          await this.peerConnection.setLocalDescription(answer)
        } catch (err: any) {
          if (err && err.toString().includes('state: stable')) {
            console.log('重新发起通道前已被连接')
          } else {
            console.log(err)
          }
          return
        }

        this.readyAddIceCandidate = true
        while (this.candidateQueue.length > 0) {
          // console.log('Queue job: addIceCandidate')
          await this.peerConnection.addIceCandidate(this.candidateQueue.shift()).catch((e) => {
            console.log(e)
          })
        }

        this.sendSignal({
          action: 'answer',
          roomName: this.roomName,
          answer: JSON.stringify(answer),
          role: this.options.role
        })
      }
    } else if (data.action === 'answer') {
      if (this.peerConnection && data.role !== this.options.role) {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)))
          // console.log('设置setRemoteDescription')
          this.readyAddIceCandidate = true
          while (this.candidateQueue.length > 0) {
            // console.log('Queue job: addIceCandidate')
            await this.peerConnection.addIceCandidate(this.candidateQueue.shift()).catch((e) => {
              console.log(e)
            })
          }
        } catch (err: any) {
          if (err && err.toString().includes('state: stable')) {
            console.log('重新发起通道前已被连接')
          } else {
            console.log(err)
          }
          return
        }
      }
    } else if (data.action === 'candidate') {
      if (this.peerConnection && data.role !== this.options.role) {
        if (this.readyAddIceCandidate) {
          // console.log('addIceCandidate')
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((e) => {
            console.log(e)
          })
        } else {
          // console.log('Add iceCandidate to queue')
          this.candidateQueue.push(new RTCIceCandidate(data.candidate))
        }
      }
    } else if (data.action === 'close') {
      if (this.peerConnection && data.role !== this.options.role) {
        this.close()
      }
    } else if (data.action === 'connect') {
      if (this.peerConnection && data.role !== this.options.role) {
        if (this.roomName === data.roomName &&
          (
            this.peerConnection.iceConnectionState === 'disconnected' ||
            this.peerConnection.connectionState === 'disconnected' ||
            this.peerConnection.iceConnectionState === 'new' ||
            this.peerConnection.connectionState === 'new'
          )
        ) {
          console.log('发现掉线的客户端')
          if (this.peerConnection) {
            try {
              for (const n in this.senderList) {
                this.peerConnection.removeTrack(this.senderList[n])
              }
              this.senderList = []
              this.peerConnection.close()
              this.peerConnection = null
            } catch (err) {
              console.log(err)
            }
          }
          console.log('尝试重连RTC被拒绝')
          return
          // setTimeout(() => {
          //   this.call(localStream, data.roomName, () => {
          //     console.log('正在重连中音频')
          //   })
          // }, 2000)
        }

        this.offer(data.roomName)
      }
    }
  }

  private iniRTCPeerConnection () {
    if (this.peerConnection) {
      try {
        for (const n in this.senderList) {
          this.peerConnection.removeTrack(this.senderList[n])
        }
        this.senderList = []
        this.peerConnection.close()
        this.peerConnection = null
      } catch (err) {
        console.log(err)
      }
    }

    this.peerConnection = new RTCPeerConnection({
      iceTransportPolicy: (this.options.iceTransportPolicy || 'all') as RTCIceTransportPolicy,
      iceServers: this.options.iceServers,
      iceCandidatePoolSize: 0,
      // @ts-ignore
      optionalArgument: {
        optional: [{
          DtlsSrtpKeyAgreement: true
        }, {
          googImprovedWifiBwe: true
        }, {
          googScreencastMinBitrate: 300
        }, {
          googIPv6: true
        }, {
          googDscp: true
        }, {
          googCpuUnderuseThreshold: 55
        }, {
          googCpuOveruseThreshold: 85
        }, {
          googSuspendBelowMinBitrate: true
        }, {
          googCpuOveruseDetection: true
        }],
        mandatory: {}
      },
      candidates: {
        host: true,
        stun: true,
        turn: true
      },
      iceProtocols: {
        tcp: true,
        udp: true
      }
    })

    this.peerConnection.oniceconnectionstatechange = (e: Event): any => {
      if (
        this.peerConnection &&
        (
          this.peerConnection.iceConnectionState === 'failed' ||
          this.peerConnection.iceConnectionState === 'disconnected' ||
          this.peerConnection.iceConnectionState === 'closed'
        )
      ) {
        console.log(this.peerConnection.iceConnectionState)
        if (this.connectStateChangeFunction) this.connectStateChangeFunction(this.peerConnection.iceConnectionState)
        // this.call(localStream, roomName, callback)
      }
    }

    this.peerConnection.onconnectionstatechange = e => {
      if (this.peerConnection) {
        if (this.connectStateChangeFunction) this.connectStateChangeFunction(this.peerConnection.connectionState)
        // switch (this.peerConnection.connectionState) {
        //   case "new":
        //   case "checking":
        //     setOnlineStatus("Connecting...");
        //     break;
        //   case "connected":
        //     setOnlineStatus("Online");
        //     break;
        //   case "disconnected":
        //     setOnlineStatus("Disconnecting...");
        //     break;
        //   case "closed":
        //     setOnlineStatus("Offline");
        //     break;
        //   case "failed":
        //     setOnlineStatus("Error");
        //     break;
        //   default:
        //     setOnlineStatus("Unknown");
        //     break;
        // }
      }
    }

    this.peerConnection.ontrack = e => {
      if (this.remoteStreamUpdateFunction) this.remoteStreamUpdateFunction(e.streams, e)
    }

    return this.peerConnection
  }

  init (localStream?: MediaStream[]): void {
    this.peerConnection = this.iniRTCPeerConnection()

    if (localStream) {
      this.localStream = localStream
      if (this.localStream && this.options.bidirection) {
        this.localStream.forEach(stream => {
          stream.getTracks().forEach(track => {
            if (this.peerConnection) this.senderList.push(this.peerConnection.addTrack(track, stream))
          })
        })
      }
    }
  }

  async offer (roomName: string) {
    if (!this.peerConnection) {
      if (this.errorFunction) this.errorFunction({ code: -3, msg: '创建会话异常' })
      return
    }

    if (!roomName) {
      if (this.errorFunction) this.errorFunction({ code: -4, msg: '创建通道异常' })
      return
    }

    if (this.roomName && this.roomName !== roomName) {
      if (this.errorFunction) this.errorFunction({ code: -5, msg: '已存在同样房间名的会话，请重新初始化会话' })
      return
    }
    this.roomName = roomName

    this.peerConnection.onicecandidate = e => {
      if (e.candidate) {
        this.sendSignal({
          action: 'candidate',
          roomName,
          role: this.options.role,
          candidate: e.candidate.toJSON()
        })
      }
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: this.options.bidirection,
      offerToReceiveVideo: this.options.bidirection
    })

    if (offer.sdp) {
      offer.sdp = processSdp(offer.sdp, {
        video: (this.options.codecs && this.options.codecs.video) || 'VP9',
        audio: (this.options.codecs && this.options.codecs.audio) || 'opus'
      })
    }

    await this.peerConnection.setLocalDescription(offer)

    this.sendSignal({
      action: 'offer',
      roomName,
      offer: JSON.stringify(offer),
      role: this.options.role
    })
  }

  async answer (roomName: string) {
    if (!this.peerConnection) {
      if (this.errorFunction) this.errorFunction({ code: -13, msg: '创建会话异常' })
      return
    }

    if (!roomName) {
      if (this.errorFunction) this.errorFunction({ code: -14, msg: '创建通道异常' })
      return
    }

    if (this.roomName && this.roomName !== roomName) {
      if (this.errorFunction) this.errorFunction({ code: -15, msg: '已存在同样房间名的会话，请重新初始化会话' })
      return
    }
    this.roomName = roomName

    this.peerConnection.onicecandidate = e => {
      if (e.candidate) {
        this.sendSignal({
          action: 'candidate',
          roomName,
          role: this.options.role,
          candidate: e.candidate.toJSON()
        })
      }
    }

    this.sendSignal({
      action: 'connect',
      roomName,
      role: this.options.role
    })
  }

  async getStats (): Promise<RTCStatsReport | null> {
    return this.peerConnection ? this.peerConnection.getStats(null) : new Promise(r => r(null))
  }

  hangup () {
    this.sendSignal({
      action: 'close',
      roomName: this.roomName,
      role: this.options.role
    })

    this.close()
  }

  close () {
    if (this.peerConnection) {
      try {
        for (const n in this.senderList) {
          this.peerConnection.removeTrack(this.senderList[n])
        }
        this.senderList = []
        this.peerConnection.close()
        this.readyAddIceCandidate = false
        this.peerConnection = null
        this.roomName = ''
      } catch (err) {
        console.log(err)
      }
    }

    if (this.connectStateChangeFunction) this.connectStateChangeFunction('closed')
  }
}
