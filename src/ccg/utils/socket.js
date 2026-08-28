import { io } from 'socket.io-client';

const socketUrl = process.env.REACT_APP_CCG_SOCKET_URL || '/ccg';
const socket = io(socketUrl, {
  withCredentials: true,
  auth: (callback) => callback({ token: localStorage.getItem('token') || '' })
});

export default socket;
