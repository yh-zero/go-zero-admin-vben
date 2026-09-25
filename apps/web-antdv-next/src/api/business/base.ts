import { requestClient } from '#/api/request';
export function uploadImage(file: File) {
  const data = new FormData();
  data.append('file_img', file);
  return requestClient.post<{ fileImgUrl: string }>(
    '/v1/sys/base/uploadFileImg',
    data,
    { headers: { 'Content-Type': undefined } },
  );
}
export const sendEmailCode = (email: string) =>
  requestClient.post('/v1/sys/base/sendEmailCode', { email, isForce: false });
