# Task Tracker

| #   | Task                                                                  | Status    |
| --- | --------------------------------------------------------------------- | --------- |
| 1   | Cài dependencies                                                      | completed |
| 2   | `.env.example` và `.env`                                              | completed |
| 3   | Prisma schema — User model                                            | completed |
| 4   | Shared — Constants                                                    | completed |
| 5   | Shared — Domain exceptions                                            | completed |
| 6   | Shared — Decorators (`@CurrentUser`)                                  | completed |
| 7   | Shared — WebSocket auth guard                                         | completed |
| 8   | Fix `main.ts`                                                         | completed |
| 9   | Fix `app.module.ts`                                                   | completed |
| 10  | Final verification                                                    | completed |
| 11  | Auth - Update Database Schema                                         | completed |
| 12  | Auth - Domain Layer (User Entity, VOs)                                | completed |
| 13  | Auth - Infrastructure (Prisma User Repo)                              | completed |
| 14  | Auth - Infrastructure (OTP & Resend)                                  | completed |
| 15  | Auth - Infrastructure (JWT & Sessions)                                | completed |
| 16  | Auth - Application (Use Cases)                                        | completed |
| 17  | Auth - Presentation (DTOs, Guards, Controller)                        | completed |
| 18  | Auth - Module Registration & WsAuthGuard                              | completed |
| 20  | Google OAuth2 - Install google-auth-library and config                | completed |
| 21  | Google OAuth2 - Create IGoogleAuthService (Domain Port)               | completed |
| 22  | Google OAuth2 - Implement GoogleAuthService (Infrastructure Adapter)  | completed |
| 23  | Google OAuth2 - Create GoogleLoginUseCase (Application Layer)         | completed |
| 24  | Google OAuth2 - Register DTO, Route, and Update AuthModule            | completed |
| 25  | Mahjong - Tile & Meld Value Objects                                   | completed |
| 26  | Mahjong - IRuleset Port Interface                                     | completed |
| 27  | Mahjong - GameState & PlayerState Entities                            | completed |
| 28  | Mahjong - Core GameEngine Domain Service                              | completed |
| 29  | Mahjong - RiichiRuleset Implementation                                | completed |
| 30  | Mahjong - ChineseRuleset Implementation                               | completed |
| 31  | Mahjong - Repositories & Database Schema Update                       | completed |
| 32  | Mahjong - Application Layer Use Cases                                 | completed |
| 33  | Mahjong - WebSocket Gateway & Module Registration                     | completed |
| 34  | Users - Domain Layer - UserStats VO & Repositories                    | completed |
| 35  | Users - Application Layer - GetUserProfileUseCase                     | completed |
| 36  | Users - Application Layer - UpdateUserProfileUseCase                  | completed |
| 37  | Users - Application Layer - GetMatchHistoryUseCase                    | completed |
| 38  | Users - Infrastructure Layer - PrismaUserStatsRepository              | completed |
| 39  | Users - Presentation Layer - DTOs & Controller                        | completed |
| 40  | Users - Module Registration & App Integration                         | completed |
| 41  | Lobby & Room - User Schema Update (Admin Role)                        | completed |
| 42  | Lobby & Room - Room Player Value Object                               | completed |
| 43  | Lobby & Room - Room Entity                                            | completed |
| 44  | Lobby & Room - Room Repository Interface                              | completed |
| 45  | Lobby & Room - Room Use Cases                                         | completed |
| 46  | Lobby & Room - Infrastructure - Redis Room Repository                 | completed |
| 47  | Lobby & Room - Lobby Service                                          | completed |
| 48  | Lobby & Room - Room & Lobby Gateways                                  | completed |
| 49  | Lobby & Room - Module Registration & App Integration                  | completed |
| 50  | Lobby & Room - Integration Verification                               | completed |
| 51  | Leaderboard - Domain Layer                                            | completed |
| 52  | Leaderboard - Application Layer (GetLeaderboardUseCase)               | completed |
| 53  | Leaderboard - Infrastructure & Presentation Layer                     | completed |
| 54  | Matchmaking - Domain Layer                                            | completed |
| 55  | Matchmaking - Redis Infrastructure Repository                         | completed |
| 56  | Matchmaking - Application Layer (Join & Leave Use Cases)              | completed |
| 57  | Matchmaking - Matchmaking Processor (Matching Loop logic)             | completed |
| 58  | Matchmaking - Application Layer (Respond to Match Use Case)           | completed |
| 59  | Matchmaking - Presentation Layer (WebSocket Gateway)                  | completed |
| 60  | Lobby - Create LobbyService and User Status Tracking                  | completed |
| 61  | Lobby - Implement Room Discovery in LobbyService                      | completed |
| 62  | Lobby - Create LobbyGateway                                           | completed |
| 63  | Lobby - Module Registration and Room Gateway Notification Integration | completed |
| 64  | Lobby - Clean Up and Legacy Code Removal                              | completed |
| 65  | Lobby - Final Verification and Build                                  | completed |
| 66  | Admin - Database Migration & Schema Update                            | completed |
| 67  | Admin - User Entity & Mapper Update                                   | completed |
| 68  | Admin - IUserRepository & PrismaUserRepository Update                 | completed |
| 69  | Admin - Custom Decorator and RolesGuard                               | completed |
| 70  | Admin - Create Use Cases for Admin Operations                         | completed |
| 71  | Admin - DTOs & Admin Controller                                       | completed |
| 72  | Admin - Admin Module and App Integration                              | completed |
| 73  | i18n - Refactor Database Schema and User Domain Entity to support UserSetting | completed |
| 74  | i18n - Create Modular Translation Dictionaries                                | completed |
| 75  | i18n - Implement I18nContext and I18nService                          | completed |
| 76  | i18n - Implement I18nMiddleware & Register Globally                   | completed |
| 77  | i18n - Standardise Validation Errors in ValidationPipe                | completed |
| 78  | i18n - Update GlobalExceptionFilter to Translate Messages              | completed |
| 79  | Brainstorming - Explore project context                                | completed |
| 80  | Brainstorming - Ask clarifying questions                               | completed |
| 81  | Brainstorming - Propose 2-3 approaches                                 | completed |
| 82  | Brainstorming - Present design                                         | completed |
| 83  | Brainstorming - Write design doc                                       | completed |
| 84  | Brainstorming - Transition to implementation                           | completed |
| 85  | Replay - Database Schema Update                                        | completed |
| 86  | Replay - Domain Layer - GameState Update                               | completed |
| 87  | Replay - Infrastructure Layer - Redis Repository Update                | completed |
| 88  | Replay - Domain & Infrastructure Layer - GameReplay Repository         | completed |
| 89  | Replay - Application Layer - Update Game Use Cases to Record Actions    | completed |
| 90  | Replay - Application & Presentation Layer - GetGameReplay              | completed |
| 91  | Replay - Module Registration                                           | completed |
| 92  | Replay - Final Verification & Test Cleanup                             | completed |
| 93  | Riichi - Domain Layer - Add isTenpai helper in RiichiRuleset           | completed |
| 94  | Riichi - Application Layer - Create DeclareRiichiUseCase               | completed |
| 95  | Riichi - Presentation Layer - Map game:riichi in GameGateway           | completed |
| 96  | Riichi - Module Registration - Register DeclareRiichiUseCase           | completed |
| 97  | Riichi - Final Verification & Test Cleanup                             | pending   |