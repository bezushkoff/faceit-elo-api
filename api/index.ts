import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname' });
  }

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

  return res.json({
    elo: cs.faceit_elo,
    level: cs.skill_level,
  });
}
