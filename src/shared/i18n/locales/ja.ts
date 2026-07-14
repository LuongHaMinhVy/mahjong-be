export const ja = {
  errors: {
    VALIDATION_ERROR: '入力データが無効です',
    RESOURCE_NOT_FOUND: 'リソースが見つかりません',
    UNAUTHORIZED: '認証されていません。ログインしてください。',
    FORBIDDEN: 'このアクションを実行する権限がありません',
    INTERNAL_SERVER_ERROR: '内部サーバーエラー',
    ORDER_CATEGORY_IN_USE: '注文カテゴリは現在使用中のため、削除できません',
    INVALID_EMAIL_OR_PASSWORD: 'メールアドレスまたはパスワードが正しくありません',
    USER_BANNED: 'アカウントは{until}まで凍結されています',
    NOT_FOUND: '{resource}が見つかりませんでした',
  },
  validation: {
    isNotEmpty: 'このフィールドは必須です',
    isEmail: '無効なメールアドレス形式です',
    minLength: '最小長は{min}文字です',
    maxLength: '最大長は{max}文字です',
  },
};
