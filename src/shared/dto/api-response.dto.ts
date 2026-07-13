export class ApiResponseDto<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: Date;

  constructor(success: boolean, message: string, data: T) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date();
  }
}
