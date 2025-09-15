import streamlit as st
import pandas as pd
import pydeck as pdk

st.set_page_config(page_title="Crime Hotspots Dashboard", layout="wide")

st.title("UK Crime Hotspots")

st.write("Upload a CSV with latitude/longitude + crime type to view a heatmap.")

uploaded = st.file_uploader("Upload CSV", type="csv")

if uploaded:
    df = pd.read_csv(uploaded)

    st.subheader("Sample of uploaded data")
    st.dataframe(df.head())

    if {"latitude", "longitude"}.issubset(df.columns):
        # Basic heatmap
        view = pdk.ViewState(latitude=54.5, longitude=-3.0, zoom=5)
        layer = pdk.Layer(
            "HeatmapLayer",
            data=df,
            get_position='[longitude, latitude]',
            radius_pixels=50,
        )
        deck = pdk.Deck(layers=[layer], initial_view_state=view)
        st.pydeck_chart(deck)
    else:
        st.error("CSV must contain 'latitude' and 'longitude' columns.")
