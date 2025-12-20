# hispanistica_games

> **Games platform for hispanistica** – Gamification modules such as quizzes for language learning.

## Project Overview

`hispanistica_games` is a web application for interactive language learning through gamification. The platform provides:

- **Gamification**: Interactive learning modules for language skills
- **Quiz**: Test and expand your language knowledge with quiz modules

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

# Run the application
python -m src.app.main
```

The application will be available at `http://localhost:8000`.

## Project Structure

```
hispanistica_games/
├── src/app/           # Flask application
│   ├── routes/        # Route blueprints
│   ├── auth/          # Authentication system
│   └── extensions/    # Flask extensions
├── templates/         # Jinja2 templates
│   └── pages/         # Page templates
├── static/           # Static assets (CSS, JS, images)
│   └── css/          # Stylesheets incl. MD3 tokens
└── docs_migration/   # Migration documentation
```

## Features

### Current Pages

- **Startseite** (`/`): Landing page with navigation cards
- **Gamification** (`/gamification`): Gamification module placeholder
- **Quiz** (`/quiz`): Quiz module placeholder
- **Impressum** (`/impressum`): Legal notice
- **Datenschutz** (`/privacy`): Privacy policy

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

## License

See [LICENSE](LICENSE) for details.
