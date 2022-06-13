import { CodecsHandler } from "./CodecsHandler"
import DetectRTC from 'detectrtc'

function isUnifiedPlanSupportedDefault () {
  var canAddTransceiver = false

  try {
    if (typeof RTCRtpTransceiver === 'undefined') return false
    if (!('currentDirection' in RTCRtpTransceiver.prototype)) return false

    var tempPc = new RTCPeerConnection()

    try {
      tempPc.addTransceiver('audio')
      canAddTransceiver = true
    } catch (e) { }

    tempPc.close()
  } catch (e) {
    canAddTransceiver = false
  }

  return canAddTransceiver && isUnifiedPlanSuppored()
}

function isUnifiedPlanSuppored () {
  var isUnifiedPlanSupported = false

  try {
    var pc = new RTCPeerConnection({
      // @ts-ignore
      sdpSemantics: 'unified-plan'
    })

    try {
      var config = pc.getConfiguration()
      // @ts-ignore
      if (config.sdpSemantics == 'unified-plan')
        isUnifiedPlanSupported = true
      // @ts-ignore
      else if (config.sdpSemantics == 'plan-b')
        isUnifiedPlanSupported = false
      else
        isUnifiedPlanSupported = false
    } catch (e) {
      isUnifiedPlanSupported = false
    }
  } catch (e) {
    isUnifiedPlanSupported = false
  }

  return isUnifiedPlanSupported
}

export const processSdp = function (sdp: string, codecs: {
  video: string,
  audio: string
}, bandwidth?: {
  video?: number,
  audio?: number,
  screen?: number
}, isScreen: boolean = false) {
  // ignore SDP modification if unified-pan is supported
  if (isUnifiedPlanSupportedDefault()) {
    return sdp
  }

  if (DetectRTC.browser.name === 'Safari') {
    return sdp
  }

  if (codecs.video.toUpperCase() === 'VP8') {
    sdp = CodecsHandler.preferCodec(sdp, 'vp8')
  }

  if (codecs.video.toUpperCase() === 'VP9') {
    sdp = CodecsHandler.preferCodec(sdp, 'vp9')
  }

  if (codecs.video.toUpperCase() === 'H264') {
    sdp = CodecsHandler.preferCodec(sdp, 'h264')
  }

  if (codecs.audio === 'G722') {
    sdp = CodecsHandler.removeNonG722(sdp)
  }

  if (DetectRTC.browser.name === 'Firefox') {
    return sdp
  }

  if ((bandwidth && bandwidth.video) || (bandwidth && bandwidth.screen)) {
    sdp = CodecsHandler.setApplicationSpecificBandwidth(sdp, bandwidth, isScreen)
  }

  if (bandwidth && bandwidth.video) {
    sdp = CodecsHandler.setVideoBitrates(sdp, {
      min: bandwidth.video * 8 * 1024,
      max: bandwidth.video * 8 * 1024
    })
  }

  if (bandwidth && bandwidth.audio) {
    sdp = CodecsHandler.setOpusAttributes(sdp, {
      maxaveragebitrate: bandwidth.audio * 8 * 1024,
      maxplaybackrate: bandwidth.audio * 8 * 1024,
      stereo: 1,
      maxptime: 3
    })
  }

  return sdp
}