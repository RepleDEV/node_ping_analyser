function getCurrent(split = "/"): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // January is 0!
    const yyyy = today.getFullYear().toString();

    return [mm, dd, yyyy]
        .map((v) => {
            return v.length == 0 ? "0" + v : v;
        })
        .join(split);
}

export { getCurrent };
