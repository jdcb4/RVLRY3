const jsonHeaders = {
  'Content-Type': 'application/json'
};

export async function createRoom(gameKey, hostName) {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ gameKey, hostName })
  });

  if (!response.ok) {
    throw new Error('Unable to create room.');
  }

  return response.json();
}

export async function joinRoom(roomCode, playerName) {
  const response = await fetch(`/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ playerName })
  });

  if (!response.ok) {
    throw new Error('Unable to join room.');
  }

  return response.json();
}
