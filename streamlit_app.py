"""질문 폐급 테스트를 Streamlit에서 보여주는 래퍼.

실제 화면과 로직은 web/ 폴더의 순수 HTML/CSS/JS다. Streamlit 컴포넌트는
상대 경로 파일을 불러올 수 없으므로, CSS·JS·이미지를 한 장의 HTML로 합쳐서 넣는다.

Run locally with:
    streamlit run streamlit_app.py
"""

import base64
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

WEB_DIR = Path(__file__).parent / "web"
FRAME_HEIGHT = 860

st.set_page_config(page_title="질문 폐급 테스트", page_icon="💬", layout="centered")

# Streamlit 기본 여백·헤더를 걷어내고 테스트 화면만 꽉 차게 보이도록 한다.
st.markdown(
    """
    <style>
    header[data-testid="stHeader"], footer, #MainMenu { display: none; }
    .block-container { padding: 0 !important; max-width: 480px !important; }
    iframe { display: block; border: 0; }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data
def build_page() -> str:
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    css = (WEB_DIR / "style.css").read_text(encoding="utf-8")
    scripts = {
        name: (WEB_DIR / name).read_text(encoding="utf-8") for name in ("data.js", "app.js")
    }

    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
    for name, code in scripts.items():
        html = html.replace(f'<script src="{name}"></script>', f"<script>{code}</script>")

    # images/xxx.svg 참조(HTML·JS 모두)를 data URI로 바꾼다.
    def to_data_uri(match: re.Match) -> str:
        data = (WEB_DIR / match.group(0)).read_bytes()
        return "data:image/svg+xml;base64," + base64.b64encode(data).decode("ascii")

    return re.sub(r"images/[\w.-]+\.svg", to_data_uri, html)


components.html(build_page(), height=FRAME_HEIGHT, scrolling=True)
