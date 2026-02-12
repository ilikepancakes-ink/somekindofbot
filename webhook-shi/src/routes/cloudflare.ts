import { Request, Response } from 'express';
import { statusStore } from '../statusStore';
import { CloudflareStatus } from '../types';
import { mapCloudflareStatus } from '../utils';

export const handleCloudflareWebhook = (req: Request, res: Response) => {
  try {
    const data: CloudflareStatus = req.body;
    
    if (!data.status || !data.status.indicator) {
      return res.status(400).json({ error: 'Invalid Cloudflare status data' });
    }

    const components = data.components?.map(component => ({
      name: component.name,
      status: mapCloudflareStatus(component.status),
      description: component.description
    })) || [];

    const statusData = {
      platform: 'cloudflare',
      status: mapCloudflareStatus(data.status.indicator),
      message: data.status.description,
      timestamp: Date.now(),
      components
    };

    statusStore.set('cloudflare', statusData);
    
    console.log(`Cloudflare status updated: ${statusData.status} - ${statusData.message}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Cloudflare status updated successfully',
      status: statusData 
    });
  } catch (error) {
    console.error('Error processing Cloudflare webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};