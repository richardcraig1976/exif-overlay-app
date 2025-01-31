import { useState, useEffect, useRef } from "react";
import { AppShell, Navbar, Select, MultiSelect, Button, ColorInput, Checkbox, NumberInput, FileInput, ScrollArea, Text } from "@mantine/core";
import ExifReader from "exifr";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Home() {
    const [images, setImages] = useState([]);
    const [resolution, setResolution] = useState("1920");
    const [textPosition, setTextPosition] = useState("top-left");
    const [fontSize, setFontSize] = useState(20);
    const [textColor, setTextColor] = useState("#FFFFFF");
    const [showOutline, setShowOutline] = useState(true);
    const [selectedExifFields, setSelectedExifFields] = useState(["camera", "date", "iso", "shutter", "aperture", "focal", "gps", "description"]);
    const canvasRefs = useRef({});

    const handleImageUpload = async (files) => {
        const imagePromises = Array.from(files).map(async (file) => {
            const url = URL.createObjectURL(file);

            let exifData = {};
            try {
                const exif = await ExifReader.parse(file);
                console.log(`EXIF Data for ${file.name}:`, exif);

                exifData = {
                    camera: exif?.Model || "N/A",
                    date: exif?.DateTimeOriginal || "N/A",
                    iso: exif?.ISO || "N/A",
                    shutter: exif?.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : "N/A",
                    aperture: exif?.FNumber ? `f/${exif.FNumber}` : "N/A",
                    focal: exif?.FocalLength ? `${exif.FocalLength}mm` : "N/A",
                    gps: exif?.latitude && exif?.longitude ? `${exif.latitude}, ${exif.longitude}` : "N/A",
                    description: exif?.ImageDescription || "N/A",
                };
            } catch (error) {
                console.error(`Error reading EXIF data for ${file.name}:`, error);
            }

            return { file, url, exifData };
        });

        const imagesData = await Promise.all(imagePromises);
        setImages(imagesData);
    };

    useEffect(() => {
        images.forEach((image) => {
            if (canvasRefs.current[image.url]) {
                drawImageWithText(image, canvasRefs.current[image.url]);
            }
        });
    }, [images, resolution, textPosition, fontSize, textColor, showOutline, selectedExifFields]);

    const drawImageWithText = (image, canvas) => {
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = image.url;
        img.onload = () => {
            let newWidth = img.width;
            let newHeight = img.height;

            if (resolution !== "original" && newWidth > resolution) {
                newHeight = (resolution / newWidth) * newHeight;
                newWidth = resolution;
            }

            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = textColor;
            ctx.strokeStyle = "black";
            ctx.lineWidth = 3;

            const allExifData = {
                camera: `Camera: ${image.exifData.camera}`,
                date: `Date: ${image.exifData.date}`,
                iso: `ISO: ${image.exifData.iso}`,
                shutter: `Shutter: ${image.exifData.shutter}`,
                aperture: `Aperture: ${image.exifData.aperture}`,
                focal: `Focal Length: ${image.exifData.focal}`,
                gps: `GPS: ${image.exifData.gps}`,
                description: `Description: ${image.exifData.description}`,
            };

            const textLines = selectedExifFields.map(field => allExifData[field]);
            const padding = 20;
            let x, y;
            let maxTextWidth = Math.max(...textLines.map((line) => ctx.measureText(line).width));

            switch (textPosition) {
                case "bottom-center":
                    x = (newWidth - maxTextWidth) / 2;
                    y = newHeight - (textLines.length * (fontSize + 5));
                    break;
                case "top-right":
                case "bottom-right":
                    x = newWidth - padding - maxTextWidth;
                    y = textPosition === "top-right" ? padding + fontSize : newHeight - (textLines.length * (fontSize + 5));
                    break;
                default:
                    x = padding;
                    y = textPosition === "top-left" ? padding + fontSize : newHeight - (textLines.length * (fontSize + 5));
            }

            textLines.forEach((line, index) => {
                if (showOutline) ctx.strokeText(line, x, y + index * (fontSize + 5));
                ctx.fillText(line, x, y + index * (fontSize + 5));
            });
        };
    };

    const downloadAllImages = async () => {
        const zip = new JSZip();
        const folder = zip.folder("exif_images");

        for (const image of images) {
            const canvas = canvasRefs.current[image.url];
            const dataUrl = canvas.toDataURL("image/jpeg");
            const blob = await fetch(dataUrl).then((res) => res.blob());
            folder.file(`${image.file.name.replace(/\.[^/.]+$/, "")}_exif.jpg`, blob);
        }

        zip.generateAsync({ type: "blob" }).then((content) => {
            saveAs(content, "exif_images.zip");
        });
    };

    return (
        <AppShell navbar={{ width: 300 }}>
                <AppShell.Navbar p="md">
                        <FileInput clearable multiple accept="image/*" placeholder="Upload Images" onChange={handleImageUpload} />
                        <Select label="Resolution" data={["1920", "1080", "original"]} value={resolution} onChange={setResolution} />
                        <Select label="Text Position" data={["top-left", "top-right", "bottom-left", "bottom-right", "bottom-center"]} value={textPosition} onChange={setTextPosition} />
                        <NumberInput label="Font Size" min={10} max={150} value={fontSize} onChange={setFontSize} />
                        <ColorInput label="Text Color" value={textColor} onChange={setTextColor} />
                        <Checkbox label="Enable Outline" checked={showOutline} onChange={(e) => setShowOutline(e.currentTarget.checked)} />
                        <MultiSelect label="EXIF Data to Display" data={["camera", "date", "iso", "shutter", "aperture", "focal", "gps"]} value={selectedExifFields} onChange={setSelectedExifFields} />
                        <Button fullWidth mt="md" color="green" onClick={downloadAllImages} disabled={images.length === 0}>
                            Download All as ZIP
                        </Button>
                </AppShell.Navbar>
                <AppShell.Main>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "20px", padding: "20px" }}>
                    {images.map((image) => (
                        <div key={image.url} style={{ textAlign: "center" }}>
                            <canvas ref={(el) => (canvasRefs.current[image.url] = el)} style={{ maxWidth: "100%", border: "1px solid black" }} />
                            <Button mt="sm" color="blue" onClick={() => downloadImage(image)}>Download</Button>
                        </div>
                    ))}
                </div>
                </AppShell.Main>
        </AppShell>
    );
}
