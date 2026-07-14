export const vi = {
  errors: {
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
    RESOURCE_NOT_FOUND: 'Không tìm thấy tài nguyên',
    UNAUTHORIZED: 'Không có quyền truy cập. Vui lòng đăng nhập.',
    FORBIDDEN: 'Bạn không có quyền thực hiện hành động này',
    INTERNAL_SERVER_ERROR: 'Lỗi hệ thống nội bộ',
    ORDER_CATEGORY_IN_USE: 'Danh mục đơn hàng đang được sử dụng và không thể xóa',
    INVALID_EMAIL_OR_PASSWORD: 'Email hoặc mật khẩu không chính xác',
    USER_BANNED: 'Tài khoản của bạn đã bị khóa cho đến {until}',
    NOT_FOUND: 'Không tìm thấy {resource}',
  },
  validation: {
    isNotEmpty: 'Trường này không được để trống',
    isEmail: 'Email không đúng định dạng',
    minLength: 'Độ dài tối thiểu là {min} ký tự',
    maxLength: 'Độ dài tối đa là {max} ký tự',
  },
};
