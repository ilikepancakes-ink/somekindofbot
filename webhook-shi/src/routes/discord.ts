import { Request, Response } from 'express';
import { statusStore } from '../statusStore';
import { DiscordStatus } from '../types';
import { mapDiscordStatus, extractComponents } from '../utils';

export const handleDiscordWebhook = (req: Request, res: Response) => {
  try {
    const data: DiscordStatus = req.body;
    
    if (!data.status || !data.status.indicator) {
      return res.status(400).json({ error: 'Invalid Discord status data' });
    }

    const statusData = {
      platform: 'discord',
      status: mapDiscordStatus(data.status.indicator),
      message: data.status.description,
      timestamp: Date.now(),
      components: extractComponents(data)
    };

    statusStore.set('discord', statusData);
    
    console.log(`Discord status updated: ${statusData.status} - ${statusData.message}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Discord status updated successfully',
      status: statusData 
    });
  } catch (error) {
    console.error('Error processing Discord webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};