import { Request, Response } from 'express';
import { statusStore } from '../statusStore';
import { GitHubStatus } from '../types';
import { mapGitHubStatus, extractComponents } from '../utils';

export const handleGitHubWebhook = (req: Request, res: Response) => {
  try {
    const data: GitHubStatus = req.body;
    
    if (!data.status || !data.status.indicator) {
      return res.status(400).json({ error: 'Invalid GitHub status data' });
    }

    const statusData = {
      platform: 'github',
      status: mapGitHubStatus(data.status.indicator),
      message: data.status.description,
      timestamp: Date.now(),
      components: extractComponents(data)
    };

    statusStore.set('github', statusData);
    
    console.log(`GitHub status updated: ${statusData.status} - ${statusData.message}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'GitHub status updated successfully',
      status: statusData 
    });
  } catch (error) {
    console.error('Error processing GitHub webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};