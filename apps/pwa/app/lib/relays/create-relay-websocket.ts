const createRelayWebSocket = (url: string): WebSocket => {
  return new WebSocket(url);
};

export { createRelayWebSocket };
