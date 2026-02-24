import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).send('No nickname provided');
  }

  const apiKey = process.env.FACEIT_KEY;
  if (!apiKey) return res.status(500).send('FACEIT_KEY not set');

  try {
    // Получаем текущего игрока
    const response = await fetch(`https://open.faceit.com/data/v4/players?nickname=${nick}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!response.ok) return res.status(404).send('Player not found');

    const data: any = await response.json();
    const cs = data.games?.cs2 || data.games?.csgo;

    if (!cs) return res.status(404).send('CS game not found');

    const currentElo: number = cs.faceit_elo;

    // Надёжно для Nightbot
    const output = `Elo: ${currentElo} | Today → Win: 0 Lose: 0 Elo: 0`;

    return res.status(200).send(output);

  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
}
