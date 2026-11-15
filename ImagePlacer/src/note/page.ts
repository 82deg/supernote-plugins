// Small shared helpers for the open note page.
import {Image} from 'react-native';
import {PluginCommAPI, PluginFileAPI} from 'sn-plugin-lib';
import {call} from '../sdk';
import type {Size} from './geometry';

export const PICTURE = 200; // Element.TYPE_PICTURE

export interface CurrentPage {
  notePath: string;
  page: number;
  /** Page size in Android px (the coordinate space of element rects). */
  pageSize: Size;
}

export async function currentPage(): Promise<CurrentPage> {
  const notePath = await call<string>('getCurrentFilePath', PluginCommAPI.getCurrentFilePath());
  const page = await call<number>('getCurrentPageNum', PluginCommAPI.getCurrentPageNum());
  const pageSize = await call<Size>('getPageSize', PluginFileAPI.getPageSize(notePath, page));
  return {notePath, page, pageSize};
}

export function imageSize(path: string): Promise<Size> {
  return new Promise((resolve, reject) =>
    Image.getSize(`file://${path}`, (width, height) => resolve({width, height}), reject),
  );
}
