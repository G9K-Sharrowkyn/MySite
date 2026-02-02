import { Server } from 'socket.io';
import cardsSpecifics from '../models/Card.js';

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, user }) => {
      socket.join(roomId);
      const players = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      io.to(roomId).emit('playersUpdate', players);
    });

    socket.on('startGame', ({ roomId }) => {
      const deck = [...cardsSpecifics];
      // prosty booster: każdy gracz dostaje 40 kart
      const shuffled = deck.sort(() => 0.5 - Math.random()).slice(0, 40);
      io.to(roomId).emit('gameStart', { deck: shuffled });
    });

    socket.on('playMove', ({ roomId, move }) => {
      socket.to(roomId).emit('opponentMove', move);
    });

    socket.on('disconnect', () => {});
  });
};
