export function checkEnv(key: string) {
    const value = process.env[key];

    if (typeof value === "undefined" || value === "") {
        throw new Error(`A value for the environment key '${key}' was not found`);
    }

    return value;
}
