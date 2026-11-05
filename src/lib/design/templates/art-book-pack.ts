import { OWN_LICENCE, type TemplateInput } from "../library";
import type { LayerInput } from "../schema";
import { ORNAMENT_PATHS } from "../items/ornaments";
import { text, effect } from "./style-helpers";

const rect = (id: string, x: number, y: number, w: number, h: number, fill: string): LayerInput => ({ id, name: id, type: "shape", role: "motif", shape: "rect", x, y, w, h, fill });
const ellipse = (id: string, x: number, y: number, w: number, h: number, fill: string): LayerInput => ({ id, name: id, type: "shape", role: "motif", shape: "ellipse", x, y, w, h, fill });

/** Original type and vector compositions. Every mark and word remains editable; no third-party cover is copied. */
export const ART_BOOK_PACK: TemplateInput[] = [
  {
    id: "tpl_poetic-cover", name: "Dạ hành khúc · poetry cover", concept: "editorial-cover",
    idea: "A slender, stepped title crosses an abstract moon; a separate swash and light trail carry the lyrical movement.",
    width: 1080, height: 1500, background: "#142c32", licence: OWN_LICENCE,
    layers: [
      ellipse("Moon", 410, 550, 580, 580, "#b4c5b2"),
      ellipse("Moon-shadow", 345, 500, 580, 580, "#142c32"),
      effect("Moonlight", "glow", "#b4c5b2", 390, 480, 620, 680, .22, .2, 30),
      rect("Spine-rule", 72, 76, 2, 1348, "#8caa9e"),
      text("Collection", "kicker", "TỦ SÁCH THƠ / POETRY", "be-vietnam-pro", 20, "#b4c5b2", 108, 82, 820, 45),
      { ...text("Da", "title", "Dạ", "cormorant-garamond", 232, "#f4edd7", 100, 215, 630, 285, 300), name: "Dạ" },
      { ...text("Hanh", "subtitle", "hành", "cormorant-garamond", 206, "#f4edd7", 260, 430, 710, 255, 300), name: "Hành" },
      { ...text("Khuc", "subtitle", "khúc", "cormorant-garamond", 230, "#f4edd7", 108, 660, 730, 290, 300), name: "Khúc" },
      { id: "Flourish", name: "Title flourish", type: "shape", role: "motif", shape: "path", path: ORNAMENT_PATHS["swash-long"], x: 130, y: 968, w: 680, h: 95, fill: "#c7b88a" },
      effect("Light-trail", "trail", "#b4c5b2", 590, 1030, 360, 220, .6, .2, 2),
      text("Whisper", "info", "Những điều đêm giữ lại", "cormorant-garamond", 40, "#b4c5b2", 110, 1140, 800, 85, 400),
      rect("Footer-rule", 110, 1305, 820, 2, "#8caa9e"),
      text("Author", "credit", "LÁPIS", "be-vietnam-pro", 26, "#f4edd7", 110, 1345, 500, 60),
      text("Edition", "credit", "TẬP THƠ / 01", "be-vietnam-pro", 20, "#b4c5b2", 705, 1353, 245, 55),
    ],
  },
  {
    id: "tpl_kinetic-cover", name: "Nếp gấp ký ức · expressive cover", concept: "editorial-cover",
    idea: "A vivid folded strip interrupts condensed black typography, balancing an expressive title with a quiet editorial colophon.",
    width: 1080, height: 1500, background: "#ece7db", licence: OWN_LICENCE,
    layers: [
      rect("Fold-left", 565, 0, 190, 1500, "#c74632"),
      rect("Fold-shadow", 755, 0, 26, 1500, "#923d32"),
      rect("Fold-highlight", 535, 0, 30, 1500, "#e6976d"),
      text("Series", "kicker", "VĂN CHƯƠNG ĐƯƠNG ĐẠI", "archivo", 23, "#232825", 72, 70, 700, 60, 600),
      text("Nep", "title", "NẾP", "anton", 285, "#232825", 55, 215, 940, 340),
      text("Gap", "subtitle", "GẤP", "anton", 285, "#232825", 55, 520, 940, 340),
      rect("Title-cut", 72, 866, 930, 18, "#232825"),
      text("Memory", "subtitle", "ký ức", "fraunces", 153, "#232825", 72, 930, 930, 220, 400),
      text("Author", "credit", "Lápis", "archivo", 32, "#232825", 72, 1205, 420, 70, 600),
      text("Synopsis", "info", "Những mảnh rời\ntìm lại một hình hài.", "archivo", 25, "#232825", 72, 1300, 420, 110),
      text("Edition", "number", "01", "anton", 100, "#232825", 825, 1270, 180, 140),
      rect("Colophon", 72, 1450, 930, 3, "#232825"),
    ],
  },
  {
    id: "tpl_idea-timeline", name: "Từ ý tưởng đến bản in · infographic", concept: "type-as-image",
    idea: "An editorial timeline uses a strong left rail, generous step labels and a contrasting summary panel. All copy is illustrative.",
    width: 1080, height: 1500, background: "#f1eadb", licence: OWN_LICENCE,
    layers: [
      text("Kicker", "kicker", "SỔ TAY THỊ GIÁC / NỘI DUNG MINH HỌA", "archivo", 20, "#355148", 72, 62, 930, 55),
      text("Title", "title", "Từ ý tưởng\nđến bản in", "fraunces", 112, "#253c38", 72, 160, 930, 280, 500),
      rect("Timeline", 110, 510, 3, 645, "#355148"),
      ...["Lắng nghe", "Chọn nhịp", "Dàn trang", "Chỉnh tinh"].flatMap((label, i) => [
        ellipse(`Node-${i}`, 89, 525 + i * 165, 45, 45, "#b85f45"),
        text(`Step-${i}`, "info", `${String(i + 1).padStart(2, "0")} / ${label}`, "archivo", 34, "#253c38", 170, 510 + i * 165, 800, 110, 600),
      ]),
      rect("Summary-panel", 72, 1205, 936, 207, "#253c38"),
      text("Summary", "info", "Một thông điệp rõ.\nMột hệ thống nhất quán.", "fraunces", 42, "#f1eadb", 110, 1242, 860, 135),
      text("Credit", "credit", "VÍ DỤ QUY TRÌNH · THAY BẰNG NỘI DUNG CỦA BẠN", "archivo", 18, "#355148", 72, 1440, 936, 40),
    ],
  },
  {
    id: "tpl_editorial-map", name: "Bản đồ ý tưởng · infographic", concept: "type-as-image",
    idea: "A circular idea map balances three connected branches against a typographic introduction. Labels describe an example, not measured data.",
    width: 1080, height: 1350, background: "#202d4b", licence: OWN_LICENCE,
    layers: [
      text("Kicker", "kicker", "GHI CHÉP SÁNG TẠO / VÍ DỤ MINH HỌA", "archivo", 20, "#b8c5db", 72, 65, 930, 45),
      text("Title", "title", "Bản đồ\ný tưởng", "fraunces", 112, "#f0e5cc", 72, 155, 930, 270, 400),
      rect("Link-one", 214, 693, 652, 3, "#b8c5db"),
      rect("Link-two", 538, 690, 3, 350, "#b8c5db"),
      ellipse("Core", 390, 540, 300, 300, "#d59872"),
      text("Core-label", "info", "Câu\nchuyện", "fraunces", 49, "#202d4b", 435, 620, 220, 155),
      ellipse("Left-node", 105, 640, 110, 110, "#b8c5db"),
      text("Left-label", "info", "Hình ảnh", "archivo", 29, "#f0e5cc", 72, 800, 300, 70),
      ellipse("Right-node", 865, 640, 110, 110, "#b8c5db"),
      text("Right-label", "info", "Ngôn từ", "archivo", 29, "#f0e5cc", 800, 800, 250, 70),
      ellipse("Lower-node", 485, 980, 110, 110, "#b8c5db"),
      text("Lower-label", "info", "Nhịp điệu", "archivo", 29, "#f0e5cc", 440, 1125, 300, 70),
      rect("Footer-rule", 72, 1250, 936, 2, "#b8c5db"),
      text("Credit", "credit", "THAY NỘI DUNG · DI CHUYỂN TỪNG NHÁNH · GIỮ MỘT Ý CHÍNH", "archivo", 18, "#b8c5db", 72, 1280, 936, 45),
    ],
  },
];
