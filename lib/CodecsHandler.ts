// fork from: https://github.com/muaz-khan/RTCMultiConnection/blob/master/dev/RTCPeerConnection.js

type Info = {
  videoCodecNumbers?: string[],
  vp8LineNumber?: string,
  vp9LineNumber?: string,
  h264LineNumber?: string
  videoCodecNumbersOriginal?: string
}

const splitLines = (sdp: string) => {
  var info: Info = {}
  sdp.split('\n').forEach(function (line) {
    if (line.indexOf('m=video') === 0) {
      info.videoCodecNumbers = []
      line.split('SAVPF')[1].split(' ').forEach(function (codecNumber: string) {
        codecNumber = codecNumber.trim()
        if (!codecNumber || !codecNumber.length) return
        if (info.videoCodecNumbers) info.videoCodecNumbers.push(codecNumber)
        info.videoCodecNumbersOriginal = line
      })
    }

    if (line.indexOf('VP8/90000') !== -1 && !info.vp8LineNumber) {
      info.vp8LineNumber = line.replace('a=rtpmap:', '').split(' ')[0]
    }

    if (line.indexOf('VP9/90000') !== -1 && !info.vp9LineNumber) {
      info.vp9LineNumber = line.replace('a=rtpmap:', '').split(' ')[0]
    }

    if (line.indexOf('H264/90000') !== -1 && !info.h264LineNumber) {
      info.h264LineNumber = line.replace('a=rtpmap:', '').split(' ')[0]
    }
  })

  return info
}

const preferCodecHelper = (sdp: string, codec: string, info: Info, ignore?: boolean) => {
  var preferCodecNumber: string | number = ''

  if (codec === 'vp8') {
    if (!info.vp8LineNumber) {
      return sdp
    }
    preferCodecNumber = info.vp8LineNumber
  }

  if (codec === 'vp9') {
    if (!info.vp9LineNumber) {
      return sdp
    }
    preferCodecNumber = info.vp9LineNumber
  }

  if (codec === 'h264') {
    if (!info.h264LineNumber) {
      return sdp
    }

    preferCodecNumber = info.h264LineNumber
  }

  var newLine = info.videoCodecNumbersOriginal?.split('SAVPF')[0] + 'SAVPF '

  var newOrder = [preferCodecNumber]

  if (ignore) {
    newOrder = []
  }

  info.videoCodecNumbers?.forEach(function (codecNumber: string) {
    if (codecNumber === preferCodecNumber) return
    newOrder.push(codecNumber)
  })

  newLine += newOrder.join(' ')
  if (info.videoCodecNumbersOriginal) {
    sdp = sdp.replace(info.videoCodecNumbersOriginal, newLine)
  }
  return sdp
}

// use "RTCRtpTransceiver.setCodecPreferences"
const preferCodec = (sdp: string, codecName: string) => {
  var info = splitLines(sdp)

  if (!info.videoCodecNumbers) {
    return sdp
  }

  if (codecName === 'vp8' && info.vp8LineNumber === info.videoCodecNumbers[0]) {
    return sdp
  }

  if (codecName === 'vp9' && info.vp9LineNumber === info.videoCodecNumbers[0]) {
    return sdp
  }

  if (codecName === 'h264' && info.h264LineNumber === info.videoCodecNumbers[0]) {
    return sdp
  }

  sdp = preferCodecHelper(sdp, codecName, info)

  return sdp
}

const removeVPX = (sdp: string) => {
  var info = splitLines(sdp)

  // last parameter below means: ignore these codecs
  sdp = preferCodecHelper(sdp, 'vp9', info, true)
  sdp = preferCodecHelper(sdp, 'vp8', info, true)

  return sdp
}

const disableNACK = (sdp: string) => {
  if (!sdp || typeof sdp !== 'string') {
    throw 'Invalid arguments.'
  }

  sdp = sdp.replace('a=rtcp-fb:126 nack\r\n', '')
  sdp = sdp.replace('a=rtcp-fb:126 nack pli\r\n', 'a=rtcp-fb:126 pli\r\n')
  sdp = sdp.replace('a=rtcp-fb:97 nack\r\n', '')
  sdp = sdp.replace('a=rtcp-fb:97 nack pli\r\n', 'a=rtcp-fb:97 pli\r\n')

  return sdp
}

const prioritize = (codecMimeType: string, peer: RTCPeerConnection) => {
  if (!peer || !peer.getSenders || !peer.getSenders().length) {
    return
  }

  if (!codecMimeType || typeof codecMimeType !== 'string') {
    throw 'Invalid arguments.'
  }

  peer.getSenders().forEach(function (sender) {
    var params = sender.getParameters()
    for (var i = 0; i < params.codecs.length; i++) {
      if (params.codecs[i].mimeType == codecMimeType) {
        // @ts-ignore
        params.codecs.unshift(params.codecs.splice(i, 1))
        break
      }
    }
    sender.setParameters(params)
  })
}

const removeNonG722 = (sdp: string) => {
  return sdp.replace(/m=audio ([0-9]+) RTP\/SAVPF ([0-9 ]*)/g, 'm=audio $1 RTP\/SAVPF 9')
}

const setBAS = (sdp: string, bandwidth: { [key: string]: any }, isScreen: boolean) => {
  if (!bandwidth) {
    return sdp
  }

  // @ts-ignore
  if (typeof isFirefox !== 'undefined' && isFirefox) {
    return sdp
  }

  if (isScreen) {
    if (!bandwidth.screen) {
      console.warn('It seems that you are not using bandwidth for screen. Screen sharing is expected to fail.')
    } else if (bandwidth.screen < 300) {
      console.warn('It seems that you are using wrong bandwidth value for screen. Screen sharing is expected to fail.')
    }
  }

  // if screen; must use at least 300kbs
  if (bandwidth.screen && isScreen) {
    sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '')
    sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.screen + '\r\n')
  }

  // remove existing bandwidth lines
  if (bandwidth.audio || bandwidth.video) {
    sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '')
  }

  if (bandwidth.audio) {
    sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n')
  }

  if (bandwidth.screen) {
    sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.screen + '\r\n')
  } else if (bandwidth.video) {
    sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.video + '\r\n')
  }

  return sdp
}

// Find the line in sdpLines that starts with |prefix|, and, if specified,
// contains |substr| (case-insensitive search).
const findLine = (sdpLines: string[], prefix: string, substr?: string) => {
  return findLineInRange(sdpLines, 0, -1, prefix, substr)
}

// Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
// and, if specified, contains |substr| (case-insensitive search).
const findLineInRange = (sdpLines: string[], startLine: number, endLine: number, prefix: string, substr?: string) => {
  var realEndLine = endLine !== -1 ? endLine : sdpLines.length
  for (var i = startLine; i < realEndLine; ++i) {
    if (sdpLines[i].indexOf(prefix) === 0) {
      if (!substr ||
        sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
        return i
      }
    }
  }
  return null
}

// Gets the codec payload type from an a=rtpmap:X line.
const getCodecPayloadType = (sdpLine: string) => {
  var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+')
  var result = sdpLine.match(pattern)
  return (result && result.length === 2) ? result[1] : null
}

const setVideoBitrates = (sdp: string, params: { [key: string]: any }) => {
  params = params || {}
  var xgoogle_min_bitrate = params.min
  var xgoogle_max_bitrate = params.max

  var sdpLines = sdp.split('\r\n')

  // VP8
  var vp8Index = findLine(sdpLines, 'a=rtpmap', 'VP8/90000')
  var vp8Payload
  if (vp8Index) {
    vp8Payload = getCodecPayloadType(sdpLines[vp8Index])
  }

  if (!vp8Payload) {
    return sdp
  }

  var rtxIndex = findLine(sdpLines, 'a=rtpmap', 'rtx/90000')
  const rtxPayload = rtxIndex ? (getCodecPayloadType(sdpLines[rtxIndex]) || '') : ''

  if (!rtxIndex) {
    return sdp
  }

  var rtxFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + rtxPayload.toString())
  if (rtxFmtpLineIndex !== null) {
    var appendrtxNext = '\r\n'
    appendrtxNext += 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' + (xgoogle_min_bitrate || '228') + '; x-google-max-bitrate=' + (xgoogle_max_bitrate || '228')
    sdpLines[rtxFmtpLineIndex] = sdpLines[rtxFmtpLineIndex].concat(appendrtxNext)
    sdp = sdpLines.join('\r\n')
  }

  return sdp
}

const setOpusAttributes = (sdp: string, params: { [key: string]: any }) => {
  params = params || {}

  var sdpLines = sdp.split('\r\n')

  // Opus
  var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000')
  var opusPayload
  if (opusIndex) {
    opusPayload = getCodecPayloadType(sdpLines[opusIndex])
  }

  if (!opusPayload) {
    return sdp
  }

  var opusFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString())
  if (opusFmtpLineIndex === null) {
    return sdp
  }

  var appendOpusNext = ''
  appendOpusNext += '; stereo=' + (typeof params.stereo != 'undefined' ? params.stereo : '1')
  appendOpusNext += '; sprop-stereo=' + (typeof params['sprop-stereo'] != 'undefined' ? params['sprop-stereo'] : '1')

  if (typeof params.maxaveragebitrate != 'undefined') {
    appendOpusNext += '; maxaveragebitrate=' + (params.maxaveragebitrate || 128 * 1024 * 8)
  }

  if (typeof params.maxplaybackrate != 'undefined') {
    appendOpusNext += '; maxplaybackrate=' + (params.maxplaybackrate || 128 * 1024 * 8)
  }

  if (typeof params.cbr != 'undefined') {
    appendOpusNext += '; cbr=' + (typeof params.cbr != 'undefined' ? params.cbr : '1')
  }

  if (typeof params.useinbandfec != 'undefined') {
    appendOpusNext += '; useinbandfec=' + params.useinbandfec
  }

  if (typeof params.usedtx != 'undefined') {
    appendOpusNext += '; usedtx=' + params.usedtx
  }

  if (typeof params.maxptime != 'undefined') {
    appendOpusNext += '\r\na=maxptime:' + params.maxptime
  }

  sdpLines[opusFmtpLineIndex] = sdpLines[opusFmtpLineIndex].concat(appendOpusNext)

  sdp = sdpLines.join('\r\n')
  return sdp
}

const extractSdp = function (sdpLine: string, pattern: string | RegExp) {
  var result = sdpLine.match(pattern)
  return result && result.length === 2 ? result[1] : null
}

// forceStereoAudio => via webrtcexample.com
// requires getUserMedia => echoCancellation:false
const forceStereoAudio = (sdp: string) => {
  let opusPayload: string | null = null
  var sdpLines = sdp.split('\r\n')
  var fmtpLineIndex = null
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i)
      break
    }
  }
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('a=fmtp') !== -1) {
      var payload = extractSdp(sdpLines[i], /a=fmtp:(\d+)/)
      if (payload === opusPayload) {
        fmtpLineIndex = i
        break
      }
    }
  }
  if (fmtpLineIndex === null) return sdp
  sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; stereo=1; sprop-stereo=1')
  sdp = sdpLines.join('\r\n')
  return sdp
}

export const CodecsHandler = {
  removeVPX: removeVPX,
  disableNACK: disableNACK,
  prioritize: prioritize,
  removeNonG722: removeNonG722,
  setApplicationSpecificBandwidth (sdp: string, bandwidth: { [key: string]: any }, isScreen: boolean) {
    return setBAS(sdp, bandwidth, isScreen)
  },
  setVideoBitrates (sdp: string, params: { [key: string]: any }) {
    return setVideoBitrates(sdp, params)
  },
  setOpusAttributes (sdp: string, params: { [key: string]: any }) {
    return setOpusAttributes(sdp, params)
  },
  preferVP9 (sdp: string) {
    return preferCodec(sdp, 'vp9')
  },
  preferCodec: preferCodec,
  forceStereoAudio: forceStereoAudio
}