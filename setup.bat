@echo off

echo =============================
echo Setting up LexConnect Project
echo =============================

echo.
echo Creating Python virtual environment...
python -m venv .venv

echo.
echo Activating virtual environment...
call .venv\Scripts\activate

echo.
echo Installing backend dependencies...
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Installing frontend dependencies...
cd frontend
npm install
cd ..

echo.
echo =============================
echo Setup Complete
echo =============================

echo.
echo To start backend:
echo .venv\Scripts\activate
echo python -m uvicorn backend.app:app --reload

echo.
echo To start frontend:
echo cd frontend
echo npm run dev