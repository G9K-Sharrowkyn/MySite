import { io } from 'socket.io-client';

const socketUrl = process.env.REACT_APP_CCG_SOCKET_URL || '/ccg';
const socket = io(socketUrl);

export default socket;
