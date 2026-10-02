import { requestClient } from '#/api/request';
export type FileVisibility = 'private' | 'public';
export interface UploadedImage {
  fileId: number;
  fileImgUrl: string;
}
export function uploadImage(file: File, visibility: FileVisibility = 'public') {
  const data = new FormData();
  data.append('file_img', file);
  data.append('visibility', visibility);
  return requestClient.post<UploadedImage>('/v1/sys/base/uploadFileImg', data, {
    headers: { 'Content-Type': undefined },
  });
}
export const sendEmailCode = (email: string) =>
  requestClient.post('/v1/sys/base/sendEmailCode', { email, isForce: false });
