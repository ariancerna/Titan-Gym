"""
Convierte APF3_TD_Grupo6_ML_Innovacion.py (formato de celdas "# %%") en el notebook .ipynb entregable.

    python construir_notebook.py
    jupyter nbconvert --to notebook --execute --inplace APF3_TD_Grupo6_ML_Innovacion.ipynb

El .py es la fuente única: se puede ejecutar como script (`python APF3_TD_Grupo6_ML_Innovacion.py`) y
genera exactamente las mismas salidas que el notebook.
"""
from pathlib import Path

import nbformat

BASE = Path(__file__).resolve().parent
FUENTE = BASE / "APF3_TD_Grupo6_ML_Innovacion.py"
DESTINO = FUENTE.with_suffix(".ipynb")

CELDA_INSTALACION = '''# Instalación de dependencias: solo es necesaria en Google Colab. En local: pip install -r requirements.txt
import subprocess
import sys

if "google.colab" in sys.modules:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q",
                           "scikit-learn==1.5.2", "fastapi==0.115.5", "httpx==0.27.2"])
'''


def celdas(texto: str):
    bloques, actual, tipo = [], [], None
    for linea in texto.splitlines():
        if linea.startswith("# %%"):
            if tipo is not None:
                bloques.append((tipo, actual))
            tipo, actual = ("markdown" if "[markdown]" in linea else "code"), []
        else:
            actual.append(linea)
    bloques.append((tipo, actual))
    for tipo, lineas in bloques:
        while lineas and not lineas[-1].strip():
            lineas.pop()
        while lineas and not lineas[0].strip():
            lineas.pop(0)
        if tipo == "markdown":
            texto_md = "\n".join(l[2:] if l.startswith("# ") else l.lstrip("#") for l in lineas)
            yield nbformat.v4.new_markdown_cell(texto_md)
        else:
            yield nbformat.v4.new_code_cell("\n".join(lineas))


def main():
    lista = list(celdas(FUENTE.read_text(encoding="utf-8")))
    lista.insert(1, nbformat.v4.new_code_cell(CELDA_INSTALACION.strip()))
    nb = nbformat.v4.new_notebook(cells=lista)
    nb.metadata = {
        "kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"},
        "language_info": {"name": "python"},
    }
    nbformat.write(nb, DESTINO)
    print(f"{DESTINO.name}: {len(lista)} celdas")


if __name__ == "__main__":
    main()
