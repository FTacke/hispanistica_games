# hispanistica_games

> **Games platform for hispanistica** – Gamification modules such as quizzes for language learning.

## Project Overview

`hispanistica_games` is a web application for interactive language learning through gamification. The platform provides:

- **Gamification**: Interactive learning modules for language skills
- **Quiz**: Test and expand your language knowledge with quiz modules
- **Admin Panel**: User management with authentication & authorization

## Quick Start

### Prerequisites

- Python 3.12+
- pip

### Installation

```bash
# Clone the repository
git clone git@github.com:FTacke/hispanistica_games.git
cd hispanistica_games

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database and create admin user
$env:START_ADMIN_USERNAME='admin'; $env:START_ADMIN_PASSWORD='SecurePass123'; python scripts/create_initial_admin.py

# Run the application
$env:FLASK_ENV='development'; $env:FLASK_SECRET_KEY='dev-secret-key'; python -m src.app.main
```

The application will be available at `http://localhost:8000`.

### Admin Access

After starting the server:
1. Open http://localhost:8000/auth/login
2. Login with username `admin` and your chosen password
3. Access user management at http://localhost:8000/auth/admin_users

**Important:** Change the admin password after first login!

For detailed admin setup instructions, see [docs/admin/ADMIN_SETUP.md](docs/admin/ADMIN_SETUP.md).

## Project Structure

```
hispanistica_games/
├── src/app/           # Flask application
│   ├── routes/        # Route blueprints
│   │   ├── public.py  # Public routes (landing, pages)
│   │   ├── auth.py    # Authentication routes
│   │   └── admin.py   # Admin API routes
│   ├── auth/          # Authentication system
│   │   ├── models.py  # User/Token ORM models
│   │   └── services.py # Auth service layer
│   └── extensions/    # Flask extensions
├── templates/         # Jinja2 templates
│   ├── auth/          # Auth & admin templates
│   └── pages/         # Public page templates
├── static/            # Static assets
│   ├── css/           # Stylesheets (incl. MD3 tokens)
│   └── js/auth/       # Admin & auth JavaScript
├── scripts/           # Utility scripts
│   └── create_initial_admin.py # Bootstrap admin user
├── docs/              # Documentation
│   └── admin/         # Admin documentation
└── data/db/           # SQLite databases (dev)
```

## Features

### Current Pages

- **Startseite** (`/`): Landing page with navigation cards
- **Gamification** (`/gamification`): Gamification module placeholder
- **Quiz** (`/quiz`): Quiz module placeholder
- **Impressum** (`/impressum`): Legal notice
- **Datenschutz** (`/privacy`): Privacy policy

### Admin Features

- **User Management** (`/auth/admin_users`):
  - Create users with invite links
  - Edit user details (email, role, status)
  - Reset user passwords
  - Search and filter users
- **Self-Service**:
  - Change own password (`/auth/account/password/page`)
  - View/edit profile (`/auth/account/profile/page`)

### Design System

The application uses Material Design 3 (MD3) with a custom color scheme:

- **Primary**: `#0F4C5C`
- **Secondary**: `#276D7B`

Color tokens are defined in `static/css/branding.css`.

## Development

### Running Tests

```bash
pytest
```

### Code Style

```bash
# Linting
ruff check .

# Type checking
mypy src/
```

## Environment Variables

### Required
```env
FLASK_SECRET_KEY=<random-secret>    # For sessions & JWT
```

### Optional
```env
FLASK_ENV=development               # development|production
AUTH_DATABASE_URL=sqlite:///data/db/auth.db  # Or postgresql://...
ACCESS_TOKEN_EXP=3600               # JWT access token lifetime (seconds)
REFRESH_TOKEN_EXP=604800            # JWT refresh token lifetime (seconds)
AUTH_HASH_ALGO=argon2               # Password hashing (argon2|bcrypt)
```

See [docs/admin/ADMIN_SETUP.md](docs/admin/ADMIN_SETUP.md) for full configuration reference.

## Documentation

- [Admin Setup Guide](docs/admin/ADMIN_SETUP.md) — Complete admin system documentation
- [Admin Auth Audit](docs/admin/admin-auth-audit.md) — Technical analysis & architecture
- [Architecture](docs/ARCHITECTURE.md) — System architecture overview

## License

See [LICENSE](LICENSE) for details.
