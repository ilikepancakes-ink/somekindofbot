import { Request, Response } from 'express';
import { statusStore } from '../statusStore';
import { formatStatusResponse } from '../utils';

export const getStatus = (req: Request, res: Response) => {
  try {
    const platform = req.query.platform as string;
    
    if (platform) {
      // Get specific platform status
      const status = statusStore.get(platform);
      if (!status) {
        return res.status(404).json({ error: `No status found for platform: ${platform}` });
      }
      
      res.status(200).json({
        platform,
        status: {
          status: status.status,
          message: status.message,
          timestamp: status.timestamp,
          components: status.components
        }
      });
    } else {
      // Get all platform statuses
      const allStatuses = statusStore.getAll();
      const response = formatStatusResponse(allStatuses);
      
      res.status(200).json(response);
    }
  } catch (error) {
    console.error('Error retrieving status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};