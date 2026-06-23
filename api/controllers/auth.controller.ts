import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await authService.register(username, password);
    res.status(201).json({ message: 'User created successfully', userId: user.get('id') });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: (error as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(username, password);
    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      userId: user.get('id'),
    });
  } catch (error) {
    res.status(401).json({ message: 'Login failed', error: (error as Error).message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }
    const tokens = await authService.refresh(refreshToken);
    res.status(200).json(tokens);
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
};
