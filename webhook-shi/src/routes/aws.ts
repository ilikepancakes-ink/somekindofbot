import { Request, Response } from 'express';
import { statusStore } from '../statusStore';
import { AWSStatus } from '../types';
import { mapAWSStatus } from '../utils';

export const handleAWSWebhook = (req: Request, res: Response) => {
  try {
    const data: AWSStatus = req.body;
    
    if (!data.service || !data.status) {
      return res.status(400).json({ error: 'Invalid AWS status data' });
    }

    const statusData = {
      platform: 'aws',
      status: mapAWSStatus(data.status),
      message: data.message || `${data.service} in ${data.region} is ${data.status}`,
      timestamp: Date.now(),
      components: [{
        name: `${data.service} (${data.region})`,
        status: mapAWSStatus(data.status),
        description: data.message
      }]
    };

    statusStore.set('aws', statusData);
    
    console.log(`AWS status updated: ${statusData.status} - ${statusData.message}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'AWS status updated successfully',
      status: statusData 
    });
  } catch (error) {
    console.error('Error processing AWS webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};