import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname provided' });
  }

  try {
    const response = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FACEIT_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const data = await response.json();
    const cs = data.games?.cs2 || data.games?.csgo;

    if (!cs) {
      return res.status(404).json({ error: 'CS game not found' });
    }

    const currentElo: number = cs.faceit_elo;

    // Для упрощения — сегодня 0 Win/Lose, Elo разница 0
    const formatted = `Elo: ${currentElo} | Today → Win: 0 Lose: 0 Elo: 0`;

    return res.status(200).send(formatted);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}
