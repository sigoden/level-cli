# level-cli

A CLI for leveldb

## Usage

```
Usage: level-cli [cmd] [options]

Commands:
  level-cli get <key>          Get value
  level-cli put <key> <value>  Set value                           [aliases: set]
  level-cli del <key>          Delete value
  level-cli list [options]     List records 

Options:
      --version   Show version number                                  [boolean]
  -h, --help      Show help                                            [boolean]
  -e, --encoding  Specify the encoding for the values [string] [default: "json"]
  -d, --db        Specify the path to the LevelDB to use
```

### Get

Get a value

```
level-cli get foo
```

### Put

Set a value

```
level-cli put foo bar
level-cli set foo bar
```

### Del

Del a value

```
level-cli del foo
```

Del values by key pattern

```
level-cli del -p foo 
```

### List


```
level-cli list [options]

List records

Options:
      --version      Show version number                               [boolean]
  -h, --help         Show help                                         [boolean]
  -e, --encoding     Specify the encoding for the values
                                                      [string] [default: "json"]
  -d, --db           Specify the path to the LevelDB to use
  -a, --all          List all the keys and values                      [boolean]
  -p, --pattern      Search records by pattern                          [string]
      --limit        List number of records              [number] [default: 100]
      --offset       Skip number of records                [number] [default: 0]
      --reverse      Reverse records                                   [boolean]
      --json         Print records in json format                      [boolean]
  -k, --only-keys    List keys only                                    [boolean]
  -v, --only-values  List values only                                  [boolean]
```

List records by pattern
```
level-cli list -p foo
level-cli list -p ^f00\\d
```

List with pagination
```
level-cli list --limit 100
level-cli list --limit 100 --offset 100
```

Print only keys
```
level-cli list -k
```

Print only values
```
level-cli list -v
```

Print in json format
```
level-cli list --json
```
