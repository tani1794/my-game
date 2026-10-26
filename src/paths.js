// 公開場所（例：https://tani1794.github.io/my-game/）に合わせた、素材ファイルの場所
export function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}
