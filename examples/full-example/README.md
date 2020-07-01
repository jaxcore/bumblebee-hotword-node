INSTALL

```
npm install --mpg123-backend=openal
```

RUN

```
node start
```

If you are using MacOSX and receive this error, it means the `mpg123-backend=openal` option was not used during install.

```
Illegal instruction: 4
```

Try again by installing `speaker` with the option:

```
npm install speaker --mpg123-backend=openal
```