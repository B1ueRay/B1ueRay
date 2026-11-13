/* Kurazh runtime config. Public values only: nothing here is a secret.
 *
 * googleClientId  Google Identity Services "Web application" OAuth client ID,
 *                 e.g. '1234567890-abc123.apps.googleusercontent.com'.
 *                 Its "Authorized JavaScript origins" must list the site origin
 *                 (e.g. https://b1ueray.github.io). Empty = demo Google chooser.
 *                 The Pages workflow can append it at deploy time from the
 *                 KURAZH_GOOGLE_CLIENT_ID repository variable.
 * peerHost        null = the public PeerJS cloud broker (0.peerjs.com).
 *                 Or your own PeerServer: 'peer.example.com', 'https://peer.example.com:9000/kurazh',
 *                 or an object { host, port, path, secure, key }.
 * iceServers      Optional STUN/TURN list for WebRTC, e.g.
 *                 [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }].
 *                 null = PeerJS defaults (Google STUN + the PeerJS demo TURN).
 *
 * Both googleClientId and peerHost can also be set on the device in the hidden
 * Developer settings screen (tap the KURAZH logo five times, or open ?dev).
 */
window.KURAZH_CONFIG = { googleClientId: '', peerHost: null, iceServers: null };
